//! Settings persistence — the disk side of Phase 4.
//!
//! Settings live in one JSON file in the OS config directory. The frontend
//! owns the shape and validation (`settings.ts`); Rust just reads and writes
//! the file as opaque JSON. Keeping Rust dumb here means the schema can evolve
//! without touching native code.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;
use tauri::{AppHandle, Manager};

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
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("corrupt settings: {e}")),
        Err(_) => Ok(Value::Null), // first run — no file yet
    }
}

/// Write settings to disk. Writes to a temp file first, then renames, so a
/// crash mid-write can never leave a half-written (and unparseable) file.
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&tmp, text).map_err(|e| format!("write failed: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename failed: {e}"))?;
    if let Some(enabled) = settings.get("startAtLogin").and_then(Value::as_bool) {
        set_start_at_login(&app, enabled)?;
    }
    Ok(())
}

fn set_start_at_login(app: &AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return set_macos_login_item(app, enabled);
    }
    #[cfg(target_os = "windows")]
    {
        return set_windows_login_item(enabled);
    }
    #[cfg(target_os = "linux")]
    {
        return set_linux_login_item(app, enabled);
    }
    #[allow(unreachable_code)]
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_macos_login_item(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|e| format!("no home dir: {e}"))?;
    let dir = home.join("Library").join("LaunchAgents");
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create LaunchAgents dir: {e}"))?;
    let plist = dir.join("dev.myperro.desktop.plist");
    if !enabled {
        return remove_if_exists(&plist);
    }

    let exe = std::env::current_exe().map_err(|e| format!("cannot locate executable: {e}"))?;
    let text = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.myperro.desktop</string>
  <key>ProgramArguments</key>
  <array><string>{}</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
"#,
        escape_xml(&exe.to_string_lossy())
    );
    fs::write(plist, text).map_err(|e| format!("write LaunchAgent failed: {e}"))
}

#[cfg(target_os = "linux")]
fn set_linux_login_item(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let dir = app
        .path()
        .config_dir()
        .map_err(|e| format!("no config dir: {e}"))?
        .join("autostart");
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create autostart dir: {e}"))?;
    let desktop = dir.join("myperro.desktop");
    if !enabled {
        return remove_if_exists(&desktop);
    }

    let exe = std::env::current_exe().map_err(|e| format!("cannot locate executable: {e}"))?;
    let text = format!(
        "[Desktop Entry]\nType=Application\nName=MyPerro\nExec={}\nX-GNOME-Autostart-enabled=true\n",
        exe.to_string_lossy()
    );
    fs::write(desktop, text).map_err(|e| format!("write autostart file failed: {e}"))
}

#[cfg(target_os = "windows")]
fn set_windows_login_item(enabled: bool) -> Result<(), String> {
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let status = if enabled {
        let exe = std::env::current_exe().map_err(|e| format!("cannot locate executable: {e}"))?;
        Command::new("reg")
            .args(["add", key, "/v", "MyPerro", "/t", "REG_SZ", "/d"])
            .arg(format!("\"{}\"", exe.to_string_lossy()))
            .args(["/f"])
            .status()
    } else {
        Command::new("reg").args(["delete", key, "/v", "MyPerro", "/f"]).status()
    }
    .map_err(|e| format!("could not update Run key: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("reg exited with status {status}"))
    }
}

fn remove_if_exists(path: &PathBuf) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "macos")]
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
