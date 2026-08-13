//! Settings persistence — the disk side of Phase 4.
//!
//! Settings live in one JSON file in the OS config directory. The frontend
//! owns the shape and validation (`settings.ts`); Rust just reads and writes
//! the file as opaque JSON. Keeping Rust dumb here means the schema can evolve
//! without touching native code.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

// Pawi used both identifiers before the rename. Keep these read-only migration
// sources so an existing companion, care state, and login preference survive.
const LEGACY_IDENTIFIERS: [&str; 2] = ["com.sabinraut.myperro", "dev.myperro.desktop"];

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create config dir: {e}"))?;
    Ok(dir.join("settings.json"))
}

/// Return the saved settings as JSON, or `null` if none exist yet. The frontend
/// runs it through `normaliseSettings`, so a partial or missing file is fine.
#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Value, String> {
    let path = settings_path(&app)?;
    let backup = path.with_extension("json.bak");
    if !path.exists() && backup.exists() {
        fs::rename(&backup, &path).map_err(|e| format!("cannot recover settings backup: {e}"))?;
    }
    let source = if path.exists() {
        path.clone()
    } else {
        let legacy_root = path
            .parent()
            .and_then(|parent| parent.parent())
            .map(PathBuf::from);
        let legacy = legacy_root.and_then(|root| {
            LEGACY_IDENTIFIERS
                .iter()
                .map(|identifier| root.join(identifier).join("settings.json"))
                .find(|candidate| candidate.exists())
        });
        match legacy.filter(|candidate| candidate.exists()) {
            Some(legacy) => {
                // Preserve the old file as a rollback copy. A failed migration
                // still loads it, so changing the stable app ID never resets a pet.
                let _ = fs::copy(&legacy, &path);
                legacy
            }
            None => path.clone(),
        }
    };
    match fs::read_to_string(&source) {
        Ok(text) => {
            let settings: Value = match serde_json::from_str(&text) {
                Ok(value) => value,
                Err(error) => {
                    let corrupt = path.with_extension("json.corrupt");
                    let _ = fs::remove_file(&corrupt);
                    let _ = fs::rename(&source, &corrupt);
                    log::warn!("Recovered corrupt settings file: {error}");
                    return Ok(Value::Null);
                }
            };
            // Repair stale development or pre-plugin login entries as soon as
            // an upgraded user launches. Waiting for the next settings save
            // could leave a dead debug executable registered indefinitely.
            if let Some(enabled) = settings.get("startAtLogin").and_then(Value::as_bool) {
                if let Err(error) = set_start_at_login(&app, enabled) {
                    log::warn!("Could not synchronize launch-at-login during migration: {error}");
                }
            }
            Ok(settings)
        }
        Err(_) => Ok(Value::Null), // first run — no file yet
    }
}

/// Write settings to disk. Writes to a temp file first, then renames, so a
/// crash mid-write can never leave a half-written (and unparseable) file.
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    let backup = path.with_extension("json.bak");
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&tmp, text).map_err(|e| format!("write failed: {e}"))?;
    let _ = fs::remove_file(&backup);
    if path.exists() {
        fs::rename(&path, &backup).map_err(|e| format!("backup failed: {e}"))?;
    }
    if let Err(error) = fs::rename(&tmp, &path) {
        if backup.exists() {
            let _ = fs::rename(&backup, &path);
        }
        return Err(format!("atomic settings replace failed: {error}"));
    }
    let _ = fs::remove_file(&backup);
    if let Some(enabled) = settings.get("startAtLogin").and_then(Value::as_bool) {
        set_start_at_login(&app, enabled)?;
    }
    Ok(())
}

fn set_start_at_login(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    let current = manager
        .is_enabled()
        .map_err(|e| format!("cannot read login setting: {e}"))?;
    if current == enabled {
        return Ok(());
    }
    if enabled {
        manager
            .enable()
            .map_err(|e| format!("cannot enable launch at login: {e}"))
    } else {
        manager
            .disable()
            .map_err(|e| format!("cannot disable launch at login: {e}"))
    }
}
