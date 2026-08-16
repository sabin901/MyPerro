# Pawi 1.0 scope and definition of done

Pawi 1.0 is a polished, private desktop companion—not a social network. This
scope is frozen until stable 1.0 ships.

## Included

- One transparent, borderless desktop pet with no permanent on-pet controls.
- Nine built-in companions with distinct appearance, tempo, idle style, voice,
  walking, running, rolling, play, sleep, petting, feeding and drinking poses.
- First-letter controls, tray controls, focus/reminders, optional input
  reactions, size control, sound control, reduced motion and peek mode.
- Local settings and needs, one-minute interruptible rest, 20-second play
  request, privacy-safe diagnostics, opt-in anonymous active-install counting.
- Windows x64, macOS Apple Silicon, macOS Intel, Linux AppImage and Debian
  packages, plus signed in-app updates.

## Deferred until after 1.0

Paw-world, accounts, messaging, calls, multiplayer games, cloud saves,
subscriptions, additional companions, user-generated packs and mobile apps.
These require a separate privacy, moderation, security and operations design.

## Severity

- P0: data loss, security/privacy breach, malicious update, installer damages
  the host, or app prevents normal desktop use. Release stops immediately.
- P1: app cannot install/start/update, pet disappears or becomes stuck, primary
  interaction is reversed/broken, opaque square appears, or a supported OS is
  unusable. Release stops.
- P2: visible animation/sound/settings defect with a workaround. Fix before
  stable unless explicitly accepted in release notes.
- P3: cosmetic or low-frequency polish issue. May be scheduled after 1.0.

## Definition of done

- `npm run release:check` is green, including the simulated eight-hour soak,
  nine-character acceptance report, privacy checks and bundle budgets.
- Every CI-native package launches and reaches the frontend-ready marker.
- Physical clean-machine evidence passes Windows 11, both Mac architectures,
  GNOME, KDE, update and rollback. Compilation is not physical evidence.
- Windows installer has a valid trusted Authenticode signature. Both Mac builds
  have Developer ID signatures, successful notarization and stapled tickets.
- A previous signed beta updates to the candidate, preserves settings, restarts
  correctly, and can be rolled back using the documented recovery path.
- Seven calendar days of final-candidate testing have no open P0/P1 issue.
- Public website downloads, checksums, SBOM and `latest.json` match the tag.

## Runtime budgets

- Median idle CPU target: below 2% on reference hardware.
- Working-set target: below 150 MB with no sustained growth during an 8-hour run.
- Rendering target: the configured frame cap, no overlapping scheduled native
  jobs, and no replay storm after sleep/resume.
- Built assets: runtime JavaScript at most 150 KiB raw, each atlas at most 2 MiB,
  and all nine atlases at most 15 MiB.
