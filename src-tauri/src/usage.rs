//! Optional anonymous active-install counting.
//!
//! This module deliberately knows nothing about pet names, activity, files,
//! windows, reminders, or settings beyond the user's explicit opt-in boolean.
//! It creates a random installation id only after consent, sends at most one
//! heartbeat per day, and deletes both the remote record and local id on
//! opt-out. The server stores only an HMAC of the random id.

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::Duration};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const HEARTBEAT_INTERVAL_SECONDS: i64 = 24 * 60 * 60;
const STATE_FILE: &str = "anonymous-usage.json";
const ENDPOINT: &str = match option_env!("IPET_USAGE_ENDPOINT") {
    Some(value) => value,
    None => "",
};
static USAGE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UsageState {
    installation_id: String,
    last_sent_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatPayload<'a> {
    installation_id: &'a str,
    app_version: String,
    platform: &'static str,
    architecture: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageResult {
    status: &'static str,
    next_allowed_at: Option<i64>,
}

fn now_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("no config directory: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("cannot create config directory: {error}"))?;
    Ok(dir.join(STATE_FILE))
}

fn load_state(path: &PathBuf) -> UsageState {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .filter(|state: &UsageState| Uuid::parse_str(&state.installation_id).is_ok())
        .unwrap_or_else(|| UsageState {
            installation_id: Uuid::new_v4().to_string(),
            last_sent_at: 0,
        })
}

fn save_state(path: &PathBuf, state: &UsageState) -> Result<(), String> {
    let temporary = path.with_extension("json.tmp");
    let backup = path.with_extension("json.bak");
    let text = serde_json::to_string(state).map_err(|error| error.to_string())?;
    fs::write(&temporary, text).map_err(|error| format!("cannot write usage state: {error}"))?;
    if backup.exists() {
        fs::remove_file(&backup).map_err(|error| format!("cannot clear usage backup: {error}"))?;
    }
    if path.exists() {
        fs::rename(path, &backup)
            .map_err(|error| format!("cannot back up usage state: {error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, path) {
        if backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        return Err(format!("cannot save usage state: {error}"));
    }
    if backup.exists() {
        let _ = fs::remove_file(&backup);
    }
    Ok(())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("iPet-anonymous-active-count/1")
        .build()
        .map_err(|error| format!("cannot create usage client: {error}"))
}

#[tauri::command]
pub async fn send_usage_heartbeat(app: AppHandle, enabled: bool) -> Result<UsageResult, String> {
    let _guard = USAGE_LOCK.lock().await;
    if !enabled {
        return Ok(UsageResult {
            status: "disabled",
            next_allowed_at: None,
        });
    }
    if ENDPOINT.trim().is_empty() {
        return Ok(UsageResult {
            status: "not_configured",
            next_allowed_at: None,
        });
    }
    if !ENDPOINT.starts_with("https://") {
        return Err("anonymous count endpoint must use HTTPS".into());
    }

    let path = state_path(&app)?;
    let mut state = load_state(&path);
    let now = now_seconds();
    let next_allowed_at = state.last_sent_at + HEARTBEAT_INTERVAL_SECONDS;
    if state.last_sent_at > 0 && now < next_allowed_at {
        return Ok(UsageResult {
            status: "throttled",
            next_allowed_at: Some(next_allowed_at),
        });
    }

    let payload = HeartbeatPayload {
        installation_id: &state.installation_id,
        app_version: app.package_info().version.to_string(),
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
    };
    let response = client()?
        .post(ENDPOINT)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("anonymous count request failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "anonymous count request returned status {}",
            response.status()
        ));
    }

    state.last_sent_at = now;
    save_state(&path, &state)?;
    Ok(UsageResult {
        status: "sent",
        next_allowed_at: Some(now + HEARTBEAT_INTERVAL_SECONDS),
    })
}

#[tauri::command]
pub async fn disable_usage_count(app: AppHandle) -> Result<UsageResult, String> {
    let _guard = USAGE_LOCK.lock().await;
    let path = state_path(&app)?;
    let had_local_state = path.exists();
    let state = fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str::<UsageState>(&text).ok());

    if !ENDPOINT.trim().is_empty() {
        if !ENDPOINT.starts_with("https://") {
            return Err("anonymous count endpoint must use HTTPS".into());
        }
        if let Some(state) = state.as_ref() {
            let response = client()?
                .delete(ENDPOINT)
                .json(&serde_json::json!({ "installationId": state.installation_id }))
                .send()
                .await
                .map_err(|error| format!("anonymous count deletion failed: {error}"))?;
            if response.status() != StatusCode::NO_CONTENT && !response.status().is_success() {
                return Err(format!(
                    "anonymous count deletion returned status {}",
                    response.status()
                ));
            }
        }
    }

    if path.exists() {
        fs::remove_file(&path).map_err(|error| format!("cannot delete usage state: {error}"))?;
    }
    Ok(UsageResult {
        status: if had_local_state {
            "deleted"
        } else {
            "disabled"
        },
        next_allowed_at: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_contains_only_anonymous_release_dimensions() {
        let payload = HeartbeatPayload {
            installation_id: "9f1e9dc1-bca5-44c2-b3a5-1c8b74b36db4",
            app_version: "0.9.0-rc.11".into(),
            platform: "windows",
            architecture: "x86_64",
        };
        let value = serde_json::to_value(payload).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 4);
        for forbidden in [
            "ownerName",
            "petName",
            "activity",
            "ip",
            "userAgent",
            "files",
        ] {
            assert!(value.get(forbidden).is_none());
        }
    }

    #[test]
    fn configured_endpoint_is_https_or_empty() {
        assert!(ENDPOINT.is_empty() || ENDPOINT.starts_with("https://"));
    }
}
