//! File-based AI-agent status bridge.
//!
//! Any local tool can write `agent-status.json` in Pawi's config directory:
//! `{ "status": "thinking" | "done" | "error", "message": "optional" }`.
//! Pawi polls it and turns that into a tiny dog reaction. This keeps the
//! integration private, local, and editor-agnostic.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn status_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("could not resolve config dir: {e}"))?;
    Ok(dir.join("agent-status.json"))
}

#[tauri::command]
pub fn load_agent_status(app: AppHandle) -> Result<Option<Value>, String> {
    let path = status_path(&app)?;
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text)
            .map(Some)
            .map_err(|e| format!("corrupt agent status: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn clear_agent_status(app: AppHandle) -> Result<(), String> {
    let path = status_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
