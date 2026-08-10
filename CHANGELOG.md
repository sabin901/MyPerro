# Changelog

All notable MyPerro changes are documented here. The project follows Semantic
Versioning once it reaches 1.0.

## 0.9.0-rc.4 — 2026-08-10

### Added

- Adjustable cute-sound volume and a one-click sound preview in Settings.
- Distinct snack, slurp, happy, sleepy, wake, yip, bark, purr, and chime cues.
- A short celebration dance after feeding and a happy shake after drinking,
  with calmer alternatives when reduced motion is enabled.
- Automated checks that reject sprite frames with an opaque rectangular
  background.

### Changed

- Rebuilt all nine companion atlases with cleaner transparent edges.
- Removed food and water bowls from Husky's neutral frames; the props now
  appear only during the matching care actions.
- Replaced long care messages above the pet with short animal sounds such as
  “Woof woof!”, “Purr purr!”, and “Nom nom!”.
- Replaced the rectangular canvas focus outline with an alpha-aware pet glow.
- Updated GitHub Actions and Linux dependencies for cross-platform CI.

### Fixed

- Removed the dark square around Midnight Cat and guarded every future pack
  against the same export defect.
- Made companion sounds loud enough to hear and reliably retried audio after
  the first user interaction when a platform blocks autoplay.
- Started care animations from their first frame and prevented stale staged
  reactions from interrupting later actions.

### Verified

- TypeScript type checking, atlas validation, production build, and 176 unit
  tests across 13 test files.
- Native NSIS, AppImage, Debian, Apple Silicon DMG, and Intel DMG packaging in
  GitHub Actions, with checksums and a CycloneDX web SBOM for each platform.

## 0.9.0-rc.3 — 2026-08-10

### Added

- Pet-only first-letter shortcuts: F Feed, W Water, P Play, R Rest, and
  S Settings while the companion window is focused.
- Shortcut guidance in onboarding, Settings, accessibility metadata, tray
  labels, and the running guide.

### Changed

- Removed every visible button and action dock from the desktop pet window.
  Transparent pixels are fully click-through; the companion is the only
  permanent desktop surface.
- Moved developer diagnostics behind Ctrl+Shift shortcuts so R always means
  Rest for users.

## 0.9.0-rc.2 — 2026-08-10

### Added

- Optional play requests after a configurable quiet interval, with a bounded
  20-second bark/message sequence that stops on petting, feeding, or play.
- A true one-minute rest state that wakes early when the companion is touched.
- Continuous desktop sizing from 65% to 200%, with monitor-edge clamping.
- Clear in-app confirmation that MyPerro is free, local, accountless, and has
  no subscription.

### Changed

- Replaced visible Care branding with a compact, accessible companion-actions
  control while retaining Feed, Water, Play, and Rest interactions.
- Replaced font-dependent structural symbols with consistent vector controls.
- Extended transient companion messages to 20 seconds.

## 0.9.0-rc.1 — 2026-08-10

### Added

- Privacy-first onboarding before global input monitoring starts.
- Native reminder notifications, rotating local logs and diagnostic export.
- Single-instance enforcement and cross-platform window-state persistence.
- Maintained Tauri autostart integration for Windows, macOS and Linux.
- Dedicated production motion cels for all nine built-in companions.
- Atlas seam, clipping and duplicate-art validation.
- Direct 44 px Settings entry on the pet and an explicit Done/restore flow.
- Reproducible Debian builder plus AppImage and Debian package smoke checks.

### Changed

- Rebuilt every premium atlas with safe transparent gutters.
- Added multi-stage animation rhythms and softer layered companion sounds.
- Increased Settings readability, target sizes and keyboard tab navigation.
- Kept the live pet from covering Settings controls while configuration is open.

### Fixed

- Packaged WebView CSP now permits local atlas JSON requests.
- Settings writes now replace existing files safely on Windows and recover
  interrupted or corrupt saves.
- Internal startup errors no longer appear raw on the desktop.

### Release blockers outside the repository

- Windows release certificate and macOS Developer ID/notarization credentials.
- Final runtime QA on supported macOS and Linux hardware.
- Updater signing key and production release endpoint.
