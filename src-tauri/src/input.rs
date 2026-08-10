//! Global input monitoring.
//!
//! PRIVACY CONTRACT — this module is the only place raw OS input is visible,
//! and it must never let a keycode escape. `KeyPress(_)` is deliberately
//! matched with a wildcard: we increment a counter and drop the key. Nothing
//! downstream of `Activity` can reconstruct what was typed, because nothing
//! downstream ever receives it.
//!
//! If you are reviewing this project for privacy, this file is the audit.

use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};

const INPUT_STARTING: u8 = 0;
const INPUT_ACTIVE: u8 = 1;
const INPUT_UNAVAILABLE: u8 = 2;
const INPUT_DISABLED: u8 = 3;

pub type SharedInputHealth = Arc<AtomicU8>;
pub type SharedInputEnabled = Arc<AtomicBool>;

#[derive(Debug, Clone, Serialize)]
pub struct InputHealth {
    pub status: &'static str,
    pub summary: &'static str,
    pub guidance: &'static str,
}

pub fn new_input_health() -> SharedInputHealth {
    Arc::new(AtomicU8::new(INPUT_DISABLED))
}

pub fn mark_input_starting(health: &SharedInputHealth) {
    health.store(INPUT_STARTING, Ordering::Relaxed);
}

pub fn mark_input_disabled(health: &SharedInputHealth) {
    health.store(INPUT_DISABLED, Ordering::Relaxed);
}

/// A user-facing, privacy-safe status. It reports whether the OS listener is
/// connected; it never exposes which keys, buttons, or applications were used.
pub fn input_health(health: &SharedInputHealth) -> InputHealth {
    match health.load(Ordering::Relaxed) {
        INPUT_ACTIVE => InputHealth {
            status: "active",
            summary: "Input reactions connected",
            guidance: "Only activity counts and pointer geometry are processed; keycodes are never stored or emitted.",
        },
        INPUT_UNAVAILABLE => InputHealth {
            status: "unavailable",
            summary: "Input reactions need attention",
            guidance: input_permission_guidance(),
        },
        INPUT_DISABLED => InputHealth {
            status: "disabled",
            summary: "Input reactions are off",
            guidance: "Enable privacy-safe input reactions in Settings. MyPerro counts activity only; it never records keycodes.",
        },
        _ => InputHealth {
            status: "starting",
            summary: "Checking input reactions",
            guidance: "Move the pointer or press a key to complete the check.",
        },
    }
}

#[cfg(target_os = "macos")]
fn input_permission_guidance() -> &'static str {
    "Grant MyPerro Accessibility permission in System Settings, then restart the app."
}

#[cfg(target_os = "linux")]
fn input_permission_guidance() -> &'static str {
    "Use an X11/XWayland session. Native Wayland may block global input monitoring by design."
}

#[cfg(target_os = "windows")]
fn input_permission_guidance() -> &'static str {
    "Restart MyPerro. If the issue remains, check endpoint-security or accessibility restrictions."
}

/// Aggregated activity. Counts and geometry only — no keycodes, ever.
#[derive(Debug, Clone, Serialize)]
pub struct Activity {
    pub cursor_x: f64,
    pub cursor_y: f64,
    /// Pixels per second, smoothed over the batch window.
    pub cursor_velocity: f64,
    pub keys_since_last: u32,
    pub clicks_since_last: u32,
    pub scroll_delta: f64,
    pub idle_ms: u64,
    /// Length of the window these counts were gathered over. The frontend needs
    /// it to convert `keys_since_last` into keys-per-second, which is what the
    /// behaviour thresholds are actually specified in.
    pub batch_ms: u64,
}

pub struct Accumulator {
    cursor: (f64, f64),
    prev_cursor: (f64, f64),
    distance: f64,
    keys: u32,
    clicks: u32,
    scroll: f64,
    last_input: Instant,
}

impl Accumulator {
    fn new() -> Self {
        Self {
            cursor: (0.0, 0.0),
            prev_cursor: (0.0, 0.0),
            distance: 0.0,
            keys: 0,
            clicks: 0,
            scroll: 0.0,
            last_input: Instant::now(),
        }
    }

    /// Drain into an `Activity` and reset the window counters.
    fn drain(&mut self, window: Duration) -> Activity {
        let secs = window.as_secs_f64().max(0.001);
        let a = Activity {
            cursor_x: self.cursor.0,
            cursor_y: self.cursor.1,
            cursor_velocity: self.distance / secs,
            keys_since_last: self.keys,
            clicks_since_last: self.clicks,
            scroll_delta: self.scroll,
            idle_ms: self.last_input.elapsed().as_millis() as u64,
            batch_ms: window.as_millis() as u64,
        };
        self.distance = 0.0;
        self.keys = 0;
        self.clicks = 0;
        self.scroll = 0.0;
        self.prev_cursor = self.cursor;
        a
    }
}

pub type SharedAccumulator = Arc<Mutex<Accumulator>>;

pub fn new_accumulator() -> SharedAccumulator {
    Arc::new(Mutex::new(Accumulator::new()))
}

impl Accumulator {
    fn note_mouse_move(&mut self, x: f64, y: f64) {
        let dx = x - self.cursor.0;
        let dy = y - self.cursor.1;
        // Ignore the first event, where the previous cursor is still (0, 0).
        if self.cursor != (0.0, 0.0) {
            self.distance += (dx * dx + dy * dy).sqrt();
        }
        self.cursor = (x, y);
        self.last_input = Instant::now();
    }

    fn note_key(&mut self) {
        self.keys += 1;
        self.last_input = Instant::now();
    }

    fn note_click(&mut self) {
        self.clicks += 1;
        self.last_input = Instant::now();
    }

    fn note_scroll(&mut self, amount: f64) {
        self.scroll += amount.abs();
        self.last_input = Instant::now();
    }
}

/// Spawn the OS input listener. Blocks its own thread forever.
///
/// The listener must never expose keycodes. On macOS we intentionally avoid
/// `rdev` because its keyboard conversion calls HIToolbox input-source APIs
/// from the event-tap thread, which can abort the process on newer macOS builds.
/// Counting `KeyDown` directly keeps the privacy contract and avoids that crash.
#[cfg(target_os = "macos")]
pub fn spawn_listener(acc: SharedAccumulator, health: SharedInputHealth, enabled: SharedInputEnabled) {
    use core_foundation::runloop::CFRunLoop;
    use core_graphics::event::{
        CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
        CallbackResult, EventField,
    };

    std::thread::spawn(move || {
        let callback_health = health.clone();
        let events = vec![
            CGEventType::MouseMoved,
            CGEventType::LeftMouseDragged,
            CGEventType::RightMouseDragged,
            CGEventType::OtherMouseDragged,
            CGEventType::LeftMouseDown,
            CGEventType::RightMouseDown,
            CGEventType::OtherMouseDown,
            CGEventType::KeyDown,
            CGEventType::ScrollWheel,
        ];

        let result = CGEventTap::with_enabled(
            CGEventTapLocation::HID,
            CGEventTapPlacement::HeadInsertEventTap,
            CGEventTapOptions::ListenOnly,
            events,
            move |_proxy, event_type, event| {
                if !enabled.load(Ordering::Relaxed) {
                    return CallbackResult::Keep;
                }
                callback_health.store(INPUT_ACTIVE, Ordering::Relaxed);
                let Ok(mut a) = acc.lock() else {
                    return CallbackResult::Keep;
                };
                match event_type {
                    CGEventType::MouseMoved
                    | CGEventType::LeftMouseDragged
                    | CGEventType::RightMouseDragged
                    | CGEventType::OtherMouseDragged => {
                        let p = event.location();
                        a.note_mouse_move(p.x, p.y);
                    }
                    CGEventType::LeftMouseDown
                    | CGEventType::RightMouseDown
                    | CGEventType::OtherMouseDown => a.note_click(),
                    CGEventType::KeyDown => {
                        if event.get_integer_value_field(EventField::KEYBOARD_EVENT_AUTOREPEAT) == 0
                        {
                            a.note_key();
                        }
                    }
                    CGEventType::ScrollWheel => {
                        let dy = event
                            .get_integer_value_field(EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_1);
                        let dx = event
                            .get_integer_value_field(EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_2);
                        a.note_scroll((dx.abs() + dy.abs()) as f64);
                    }
                    _ => {}
                }
                CallbackResult::Keep
            },
            CFRunLoop::run_current,
        );

        if result.is_err() {
            health.store(INPUT_UNAVAILABLE, Ordering::Relaxed);
            eprintln!(
                "[myperro] input monitoring unavailable. \
                 Running in degraded mode — grant Accessibility permission to enable reactions."
            );
        }
    });
}

/// Spawn the OS input listener. Blocks its own thread forever.
#[cfg(not(target_os = "macos"))]
pub fn spawn_listener(acc: SharedAccumulator, health: SharedInputHealth, enabled: SharedInputEnabled) {
    std::thread::spawn(move || {
        let callback_health = health.clone();
        let result = rdev::listen(move |event| {
            if !enabled.load(Ordering::Relaxed) {
                return;
            }
            callback_health.store(INPUT_ACTIVE, Ordering::Relaxed);
            let Ok(mut a) = acc.lock() else { return };
            match event.event_type {
                rdev::EventType::MouseMove { x, y } => {
                    a.note_mouse_move(x, y);
                }
                // Wildcard on purpose. We count the keystroke; we never look at it.
                rdev::EventType::KeyPress(_) => {
                    a.note_key();
                }
                rdev::EventType::ButtonPress(_) => {
                    a.note_click();
                }
                rdev::EventType::Wheel { delta_x, delta_y } => {
                    a.note_scroll((delta_x.abs() + delta_y.abs()) as f64);
                }
                _ => {}
            }
        });

        if let Err(e) = result {
            health.store(INPUT_UNAVAILABLE, Ordering::Relaxed);
            eprintln!(
                "[myperro] input monitoring unavailable ({:?}). \
                 Running in degraded mode — grant Accessibility permission to enable reactions.",
                e
            );
        }
    });
}

/// Adaptive snapshot rate — master plan §12.
///
/// A desktop pet spends most of its life doing nothing, and a fixed 15 Hz pump
/// keeps both the Rust thread and the WebView awake for no reason. Dropping to
/// 1 Hz while the dog sleeps is the single largest idle-CPU saving available,
/// and it costs nothing in responsiveness: the first real input pulls the
/// cadence straight back to Active.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cadence {
    /// User is doing something. 15 Hz.
    Active,
    /// Quiet but awake. 5 Hz.
    Calm,
    /// Asleep. 1 Hz.
    Resting,
    /// Window hidden. No snapshots at all.
    Hidden,
}

impl Cadence {
    pub fn interval(self) -> Duration {
        match self {
            Cadence::Active => Duration::from_millis(66),
            Cadence::Calm => Duration::from_millis(200),
            Cadence::Resting => Duration::from_millis(1000),
            Cadence::Hidden => Duration::from_millis(1000),
        }
    }

    /// Thresholds mirror the behaviour engine's rest states so the cadence
    /// steps down at the same moments the dog visibly settles.
    pub fn for_idle(idle_ms: u64, hidden: bool) -> Self {
        if hidden {
            Cadence::Hidden
        } else if idle_ms > 300_000 {
            Cadence::Resting
        } else if idle_ms > 60_000 {
            Cadence::Calm
        } else {
            Cadence::Active
        }
    }
}

/// Drain the accumulator over a specific window. The window length must be the
/// real elapsed time, not a constant, or `cursor_velocity` and the frontend's
/// keys-per-second conversion both come out wrong at non-Active cadences.
pub fn drain_over(acc: &SharedAccumulator, window: Duration) -> Option<Activity> {
    acc.lock().ok().map(|mut a| a.drain(window))
}

/// Peek at idle time without draining, so the pump can choose its next cadence.
pub fn idle_ms(acc: &SharedAccumulator) -> u64 {
    acc.lock()
        .ok()
        .map(|a| a.last_input.elapsed().as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn input_health_starts_disabled_until_consent() {
        let health = new_input_health();
        let snapshot = input_health(&health);
        assert_eq!(snapshot.status, "disabled");
        assert!(!snapshot.guidance.is_empty());
    }

    #[test]
    fn cadence_steps_down_and_stops_when_hidden() {
        assert_eq!(Cadence::for_idle(0, false), Cadence::Active);
        assert_eq!(Cadence::for_idle(60_001, false), Cadence::Calm);
        assert_eq!(Cadence::for_idle(300_001, false), Cadence::Resting);
        assert_eq!(Cadence::for_idle(0, true), Cadence::Hidden);
    }

    #[test]
    fn activity_serialization_never_contains_a_keycode() {
        let acc = new_accumulator();
        {
            let mut value = acc.lock().expect("test accumulator should lock");
            value.note_key();
        }
        let activity = drain_over(&acc, Duration::from_secs(1)).expect("activity should drain");
        let json = serde_json::to_value(activity).expect("activity should serialize");
        assert_eq!(json["keys_since_last"], 1);
        assert!(json.get("keycode").is_none());
        assert!(json.get("key").is_none());
    }
}
