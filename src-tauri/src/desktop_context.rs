//! Privacy-safe foreground media classification.
//!
//! Window titles and process paths are inspected only inside this function and
//! are never serialized, logged, persisted, or sent to the webview. The UI
//! receives one of two coarse states: none or video.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    None,
    Video,
}

#[derive(Serialize)]
pub struct DesktopContext {
    pub media: MediaKind,
}

const VIDEO_APPS: &[&str] = &[
    "quicktime player",
    "movies & tv",
    "media player",
    "netflix",
    "plex",
    "kodi",
    "potplayer",
    "mpv",
    "mpc-hc",
    "iina",
    "tv.app",
];

const BROWSERS: &[&str] = &[
    "chrome", "chromium", "firefox", "safari", "edge", "brave", "opera", "vivaldi", "arc",
];

const VIDEO_TITLE_MARKERS: &[&str] = &[
    "youtube",
    "netflix",
    "prime video",
    "disney+",
    "hulu",
    "vimeo",
    "twitch",
    "max -",
    "apple tv+",
    "crunchyroll",
];

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

pub fn classify(app_name: &str, title: &str) -> MediaKind {
    let app = app_name.to_lowercase();
    let title = title.to_lowercase();
    if contains_any(&app, VIDEO_APPS) || app == "vlc" || app.contains("vlc media player") {
        return MediaKind::Video;
    }
    if contains_any(&app, BROWSERS) && contains_any(&title, VIDEO_TITLE_MARKERS) {
        return MediaKind::Video;
    }
    MediaKind::None
}

#[tauri::command]
pub fn desktop_context() -> DesktopContext {
    let media = active_win_pos_rs::get_active_window()
        .map(|window| classify(&window.app_name, &window.title))
        .unwrap_or(MediaKind::None);
    DesktopContext { media }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_native_and_browser_video() {
        assert_eq!(classify("VLC media player", "movie.mp4"), MediaKind::Video);
        assert_eq!(
            classify("Google Chrome", "A video - YouTube"),
            MediaKind::Video
        );
        assert_eq!(classify("Safari", "Netflix"), MediaKind::Video);
    }

    #[test]
    fn ordinary_browsing_and_apps_stay_private_and_unclassified() {
        assert_eq!(
            classify("Google Chrome", "Private document"),
            MediaKind::None
        );
        assert_eq!(
            classify("Visual Studio Code", "youtube.ts"),
            MediaKind::None
        );
        assert_eq!(classify("Spotify", "Anything"), MediaKind::None);
    }
}
