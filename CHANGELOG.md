# Changelog

## 0.9.0-rc.12 — 2026-08-15

- Gave all nine built-in companions distinct, tested personality profiles that
  change idle rhythm, autonomous roaming cadence, travel speed, play-roll
  chance, and voice pitch/presence instead of behaving as visual skin swaps.
- Replaced nine competing pet-window intervals with one cooperative runtime
  scheduler. Slow native calls cannot overlap themselves or replay a backlog
  after sleep/resume.
- Fixed species audio: dogs no longer purr when petted, cat attention uses a
  dedicated rise-and-fall meow, keyboard gestures unlock Web Audio, and the
  Settings preview uses the selected companion's voice. Settings now includes
  one-click recovery when sound, full motion, or automatic peek were disabled.
- Reset squash, bounce, and effects timing on each presentation state to remove
  phase jumps, while keeping motion tempo consistent with personality speed.
- Added locomotion ground-line validation for every art pack, a privacy-safe
  runtime snapshot in diagnostic exports, and a repository/stable release gate
  covering version parity, platform bundles, publisher credentials, updater
  signing, and physical acceptance evidence.

All notable Pawi changes are documented here. The project follows Semantic
Versioning once it reaches 1.0.

## 0.9.0-rc.11 — 2026-08-12

### Changed

- Established **Pawi** (pronounced “paw-ee”) as the complete product identity
  across the application, installers, website, updater, diagnostics, package
  metadata, documentation, CI artifacts, and brand assets.
- Moved new application data to the Pawi namespace while retaining read-only
  migration paths for settings, virtual-pet needs, and interaction history.

### Fixed

- Preserved Apple Silicon and Intel-specific Mac packaging checks under the new
  `Pawi.app` and `pawi` executable names.

## 0.9.0-rc.10 — 2026-08-11

### Changed

- Unified the website, application, Settings, installer, dock/taskbar, and tray
  artwork around one canonical Pawi identity.
- Added real in-app animation previews for all nine companions, companion deep
  links, preview sizing, swipe and keyboard navigation, responsive navigation,
  and a scroll-driven product story to the public website.
- Added shared brand tokens, asset synchronization, and documented logo usage
  so future builds keep every surface consistent.

### Fixed

- Marked the monochrome tray asset as macOS template artwork so it remains
  legible in both light and dark menu bars.
- Independently built and launched the packaged Intel Mac application in CI,
  alongside Apple Silicon, Windows, and Linux package verification.

## 0.9.0-rc.9 — 2026-08-11

### Changed

- Published signed builds, including release candidates, now check the official
  update channel 15 seconds after startup and every six hours thereafter.
- Update discovery remains private and non-disruptive: Pawi shows a local
  notice, then waits for the user to confirm installation in Settings.
- Developer and local builds remain disconnected from the public release
  channel.

### Fixed

- Closed updater resources after automatic and manual checks, including when an
  update is declined, repeated, unavailable, or fails.
- Added release-channel regression tests covering stable, release-candidate,
  beta, developer, local, malformed, and placeholder versions.

### Upgrade note

- Existing rc.7 and rc.8 installations require one manual **Settings → Check
  for updates** action because their installed code did not poll automatically.
  After rc.9 is installed, future signed releases are discovered automatically.

## 0.9.0-rc.8 — 2026-08-11

### Changed

- Replaced competing presentation overrides with one tested behaviour director.
- Added anticipate, travel, and settle phases to desktop roaming so movement
  begins and ends as a coherent action.
- Care, rest, previews, and direct interaction now stop native roaming; pets no
  longer eat, drink, or pose while sliding across the screen.
- Play protects only its starting input, then yields cleanly to genuine typing,
  dragging, care, and other direct user activity.
- Removed the headphone shortcut, artwork overlay, foreground music-player
  classification, settings entry, accessibility metadata, and documentation.
- Rebuilt the public website as a restrained vintage editorial download page,
  with human-written copy, clearer platform rows, and no decorative emoji,
  synthetic badges, fake browser chrome, or generic card-wall layout.

### Verification

- Added a presentation conflict matrix and roaming phase regression tests.
- Verified desktop and mobile website layouts, interaction states, overflow,
  console output, TypeScript, Vitest, and Rust media classification locally.
- Built rc.8 packages on Windows, Ubuntu, Apple Silicon macOS, and Intel macOS;
  both mounted Mac applications launched to frontend readiness in CI.

## 0.9.0-rc.7 — 2026-08-11

### Changed

- Added explicit native-facing metadata to every animation in all nine
  companion packs, with strict validation in both the pack schema and premium
  art pipeline.
- Standardized pointer geometry and velocity on physical coordinates plus the
  cursor monitor's DPI scale for Retina and mixed-DPI desktops.

### Fixed

- Corrected leftward roaming that displayed a right-facing companion because
  the premium locomotion cel was authored left-facing but mirrored under the
  legacy right-facing convention.
- Prevented background cursor heartbeats from reversing a companion while its
  window is already roaming in the opposite direction.
- Made alpha hit-testing mirror-aware, keeping clicks, petting and drag pickup
  aligned with asymmetric visible silhouettes.
- Kept directional run/walk animation visible during playful roaming instead
  of replacing it with a stationary zoomies pose.
- Allowed direct dragging to immediately preempt a timed reminder, matching
  the behavior engine's documented interaction priority.

### Verified

- 187 frontend behavior tests across 15 files, six Rust privacy/platform
  tests, strict Rust linting, production app/website builds, all nine semantic
  art validators, packaged CSP/asset smoke tests, and native Windows startup.
- Native installers/packages from the same revision on Windows, Ubuntu,
  Apple Silicon macOS, and Intel macOS; both packaged Mac apps launched to
  frontend readiness from their mounted DMGs.

## 0.9.0-rc.6 — 2026-08-10

### Added

- Privacy-safe foreground media reactions for supported video players, plus a
  manual N shortcut.
- Cryptographically signed updater bundles and manifests for Windows, macOS
  Apple Silicon, macOS Intel, AppImage, and Debian packages.
- Packaged-DMG startup verification on both supported Mac architectures.

### Changed

- Reworked the semantic pose mapping for all nine companions so typing, walking,
  resting, care actions, and celebrations consistently show the intended art.
- Peek mode now remains active until it is explicitly dismissed instead of
  being interrupted by ordinary idle behavior.

### Fixed

- Removed celebration poses from neutral states, opposite-facing walk frames,
  keyboard/laptop swaps during typing, generic square pupil artifacts, and
  food and water props from the Husky's neutral pose.
- Corrected Mac packaging checks so an installable DMG must mount, contain the
  expected CPU architecture, pass signature verification, launch, and reach
  frontend readiness before a release is prepared.

### Verified

- TypeScript, unit, production, website, semantic art, packaged-page, Rust,
  dependency, and security checks.
- Native packages on Windows, Ubuntu 22.04, Apple Silicon macOS, and Intel
  macOS from the same source revision.

## 0.9.0-rc.5 — 2026-08-10

### Added

- A complete responsive download website with an interactive behavior showcase,
  all nine companions, privacy explanation, FAQs, and direct downloads for
  Windows, Apple Silicon, Intel Mac, AppImage, and Debian.
- GitHub Pages deployment from the same tested source and generated companion
  previews, so the public page cannot drift away from the app's character art.
- Continuous desktop roaming with natural acceleration, screen-safe targets,
  direction changes, playful running, a procedural rolling/tumble phase, and
  recovery back into movement.
- Four deterministic roaming tests covering screen bounds, interpolation,
  playful roll timing, and displays too small to fit the companion.

### Changed

- Reduced the idle delay before a companion starts exploring the desktop.
- Play now starts a longer roaming sequence instead of animating in one spot.
- Removed every card, border, pointer, and shadow behind pinned or temporary
  pet text; only outlined transparent text remains above the real desktop.
- Extended the release gate to build the public website on every release check.

### Fixed

- Separated input-monitor heartbeat time from real user activity time so idle
  animations and roaming can begin even while the native monitor is healthy.

### Verified

- TypeScript type checking, production app and website builds, atlas validation,
  packaged-page smoke checks, 181 unit tests across 14 files, and 3 Rust tests.
- Desktop and 390 px mobile website layouts, all nine generated previews, live
  animation controls, five direct platform links, and zero browser console errors.

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
- Clear in-app confirmation that Pawi is free, local, accountless, and has
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
