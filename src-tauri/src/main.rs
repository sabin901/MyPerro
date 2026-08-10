// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent_status;
mod input;
mod settings_store;

use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;

#[derive(Serialize)]
struct PerfStats {
    cpu: f32,
    mem_mb: f64,
}

struct SysState(Mutex<System>);

struct InputServiceState {
    health: input::SharedInputHealth,
    accumulator: input::SharedAccumulator,
    enabled: input::SharedInputEnabled,
    started: AtomicBool,
}

fn start_input_service(state: &InputServiceState) {
    state.enabled.store(true, Ordering::SeqCst);
    input::mark_input_starting(&state.health);
    if state
        .started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }
    input::spawn_listener(
        state.accumulator.clone(),
        state.health.clone(),
        state.enabled.clone(),
    );
}

/// Self-reported CPU and memory, so Phase 1 exit criteria can be measured
/// without alt-tabbing to Activity Monitor and disturbing the numbers.
#[tauri::command]
fn perf_stats(state: tauri::State<'_, SysState>) -> PerfStats {
    let pid = Pid::from_u32(std::process::id());
    let mut sys = state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::everything(),
    );
    match sys.process(pid) {
        Some(p) => PerfStats {
            cpu: p.cpu_usage(),
            mem_mb: p.memory() as f64 / 1_048_576.0,
        },
        None => PerfStats {
            cpu: 0.0,
            mem_mb: 0.0,
        },
    }
}

#[tauri::command]
async fn open_settings(app: tauri::AppHandle) {
    show_settings_window(&app);
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(pet) = app.get_webview_window("pet") {
        let _ = pet.set_always_on_top(false);
        // A topmost transparent pet can otherwise cover controls in the
        // settings window on Windows. The settings preview keeps the
        // companion visible while configuration is open; closing Settings
        // restores the live desktop pet from the frontend event handler.
        let _ = pet.hide();
    }
    if let Some(settings) = app.get_webview_window("settings") {
        let _ = settings.set_always_on_top(true);
        let _ = settings.show();
        let _ = settings.unminimize();
        let _ = settings.set_focus();
    }
}

/// Toggle click-through from the frontend's per-pixel hit test.
#[tauri::command]
fn set_pass_through(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn input_health(state: tauri::State<'_, InputServiceState>) -> input::InputHealth {
    input::input_health(&state.health)
}

#[tauri::command]
fn enable_input_monitoring(state: tauri::State<'_, InputServiceState>) {
    start_input_service(&state);
}

#[tauri::command]
fn disable_input_monitoring(state: tauri::State<'_, InputServiceState>) {
    state.enabled.store(false, Ordering::SeqCst);
    input::mark_input_disabled(&state.health);
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticReport {
    app: &'static str,
    version: String,
    author: &'static str,
    os: &'static str,
    architecture: &'static str,
    config_directory: String,
    log_directory: String,
}

/// Privacy-safe environment details for the user-controlled diagnostics
/// download. It deliberately excludes usernames, file contents and input data.
#[tauri::command]
fn diagnostic_report(app: tauri::AppHandle) -> Result<DiagnosticReport, String> {
    let config_directory = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config directory: {e}"))?;
    let log_directory = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("no log directory: {e}"))?;
    Ok(DiagnosticReport {
        app: "MyPerro",
        version: app.package_info().version.to_string(),
        author: "Sabin Raut",
        os: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        config_directory: config_directory.display().to_string(),
        log_directory: log_directory.display().to_string(),
    })
}

fn main() {
    let input_service = InputServiceState {
        health: input::new_input_health(),
        accumulator: input::new_accumulator(),
        enabled: std::sync::Arc::new(AtomicBool::new(false)),
        started: AtomicBool::new(false),
    };
    tauri::Builder::default()
        // Keep this first: the plugin must claim the process before windows,
        // input listeners, tray icons or timers are created.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(pet) = app.get_webview_window("pet") {
                let _ = pet.show();
            }
            show_settings_window(app);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .max_file_size(1_000_000)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(SysState(Mutex::new(System::new())))
        .manage(input_service)
        .invoke_handler(tauri::generate_handler![
            perf_stats,
            mark_startup_ready,
            open_settings,
            set_pass_through,
            input_health,
            enable_input_monitoring,
            disable_input_monitoring,
            diagnostic_report,
            agent_status::load_agent_status,
            agent_status::clear_agent_status,
            settings_store::load_settings,
            settings_store::save_settings
        ])
        .setup(|app| {
            // ── tray ──────────────────────────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show / hide puppy", true, None::<&str>)?;
            let feed = MenuItem::with_id(app, "feed", "Feed (F)", true, None::<&str>)?;
            let water = MenuItem::with_id(app, "water", "Water (W)", true, None::<&str>)?;
            let play = MenuItem::with_id(app, "play", "Play (P)", true, None::<&str>)?;
            let rest = MenuItem::with_id(app, "rest", "Rest (R)", true, None::<&str>)?;
            let tour = MenuItem::with_id(app, "tour", "Play animation tour", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "focus", "Start / stop focus", true, None::<&str>)?;
            let quiet = MenuItem::with_id(app, "quiet", "Quiet mode", true, None::<&str>)?;
            let peek = MenuItem::with_id(app, "peek", "Toggle peek mode", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings… (S)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &show, &feed, &water, &play, &rest, &tour, &focus, &quiet, &peek, &settings,
                    &quit,
                ],
            )?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("MyPerro")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("pet") {
                            let visible = w.is_visible().unwrap_or(true);
                            let _ = if visible { w.hide() } else { w.show() };
                        }
                    }
                    "settings" => {
                        show_settings_window(app);
                    }
                    "play" => {
                        let _ = app.emit("play-toggle", ());
                    }
                    "feed" | "water" | "rest" => {
                        let _ = app.emit("care-action", event.id.as_ref());
                    }
                    "tour" => {
                        let _ = app.emit("preview-action", "all");
                    }
                    "focus" => {
                        let _ = app.emit("pomodoro-toggle", ());
                    }
                    "quiet" => {
                        let _ = app.emit("quiet-toggle", ());
                    }
                    "peek" => {
                        let _ = app.emit("peek-toggle", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // ── input service ─────────────────────────────────────────────
            // Do not touch global input APIs until the user has seen the
            // privacy explanation and opted in. Existing consent is restored
            // from settings; first-run users are taken to onboarding.
            let saved = settings_store::load_settings(app.handle().clone()).unwrap_or_default();
            let consented = saved
                .get("inputMonitoringEnabled")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let input_state = app.state::<InputServiceState>();
            if consented {
                start_input_service(&input_state);
            } else {
                show_settings_window(app.handle());
            }
            let acc = input_state.accumulator.clone();

            // ── adaptive aggregation pump (plan §12) ──────────────────────
            // One event per batch, not one per OS event — the difference
            // between ~1% and ~15% CPU. The cadence then steps down as the
            // user goes quiet: 15 Hz active, 5 Hz calm, 1 Hz resting, and
            // nothing at all while the window is hidden.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut cadence = input::Cadence::Active;
                loop {
                    let interval = cadence.interval();
                    std::thread::sleep(interval);

                    let hidden = handle
                        .get_webview_window("pet")
                        .and_then(|w| w.is_visible().ok())
                        .map(|visible| !visible)
                        .unwrap_or(false);

                    // Recompute cadence before draining, so the next sleep is
                    // already correct even if we skip this emission.
                    cadence = input::Cadence::for_idle(input::idle_ms(&acc), hidden);

                    if cadence == input::Cadence::Hidden {
                        continue; // no snapshots while hidden — nothing can see them
                    }

                    // Drain over the interval we actually slept, otherwise
                    // velocity and keys-per-second are wrong at low cadences.
                    if let Some(activity) = input::drain_over(&acc, interval) {
                        let _ = handle.emit("activity", activity);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MyPerro");
}

/// A fixed-path, opt-in readiness marker used only by packaged-app CI.
/// Normal installations never set the environment gate and never write it.
#[tauri::command]
fn mark_startup_ready() -> Result<bool, String> {
    if std::env::var("MYPERRO_CI_SMOKE").as_deref() != Ok("1") {
        return Ok(false);
    }
    let marker = std::env::temp_dir().join("myperro-startup-ready");
    std::fs::write(&marker, b"ready\n")
        .map_err(|error| format!("cannot write startup marker: {error}"))?;
    Ok(true)
}
