// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod input;
mod agent_status;
mod settings_store;

use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

#[derive(Serialize)]
struct PerfStats {
    cpu: f32,
    mem_mb: f64,
}

struct SysState(Mutex<System>);

/// Self-reported CPU and memory, so Phase 1 exit criteria can be measured
/// without alt-tabbing to Activity Monitor and disturbing the numbers.
#[tauri::command]
fn perf_stats(state: tauri::State<'_, SysState>) -> PerfStats {
    let pid = Pid::from_u32(std::process::id());
    let mut sys = state.0.lock().unwrap();
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
        None => PerfStats { cpu: 0.0, mem_mb: 0.0 },
    }
}

#[tauri::command]
fn open_settings(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("settings.html".into()))
        .title("MyPerro")
        .inner_size(420.0, 520.0)
        .resizable(false)
        .build();
}

/// Toggle click-through from the frontend's per-pixel hit test.
#[tauri::command]
fn set_pass_through(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(SysState(Mutex::new(System::new())))
        .invoke_handler(tauri::generate_handler![
            perf_stats,
            open_settings,
            set_pass_through,
            agent_status::load_agent_status,
            agent_status::clear_agent_status,
            settings_store::load_settings,
            settings_store::save_settings
        ])
        .setup(|app| {
            // ── tray ──────────────────────────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show / hide puppy", true, None::<&str>)?;
            let play = MenuItem::with_id(app, "play", "Play with puppy", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "focus", "Start / stop focus", true, None::<&str>)?;
            let quiet = MenuItem::with_id(app, "quiet", "Quiet mode", true, None::<&str>)?;
            let peek = MenuItem::with_id(app, "peek", "Toggle peek mode", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &play, &focus, &quiet, &peek, &settings, &quit])?;

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
                    "settings" => open_settings(app.clone()),
                    "play" => {
                        let _ = app.emit("play-toggle", ());
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
            let acc = input::new_accumulator();
            input::spawn_listener(acc.clone());

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
