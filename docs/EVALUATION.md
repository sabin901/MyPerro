# MyPerro production evaluation — 10 August 2026

## Executive verdict

MyPerro `0.9.0-rc.4` is a credible public release candidate and a good fit for
a free, accountless public beta. It is no longer a prototype: the current
Windows executable and installer build and run, the same revision produces
Linux AppImage and Debian packages and reaches `Pet ready` in a native startup
smoke test, and CI now builds separate Apple Silicon and Intel macOS DMGs.

It is deliberately local-only: there is no sign-up, subscription, payment,
cloud account, telemetry, or runtime service dependency. The desktop surface
contains no Care panel or action button; feed, water, play, and rest remain as
focused first-letter, right-click, and tray interactions because they are core
companion behaviors.

It is not yet an unconditional stable public release. The remaining hard gates
are publisher signing, a notarized macOS build, and physical clean-machine QA.
Those require credentials and hardware outside this workspace and cannot be
honestly replaced by source-level checks.

**Readiness:** 9.0/10 as a product, 8.9/10 as a release candidate, and 7.9/10
as a stable public-release operation.

## Acceptance evidence

| Check | Result | Evidence |
|---|---:|---|
| TypeScript | Pass | `tsc --noEmit` on Windows and Linux |
| Frontend logic | Pass | 13 Vitest files, 176 tests on Windows and Linux |
| Interaction timing | Pass | explicit tests for 20-second requests, cooldown, initial anti-nag behavior, 60-second rest, and touch-to-wake |
| Native privacy logic | Pass | 3 Rust tests, including no-keycode serialization, on Windows and Linux |
| Production frontend | Pass | Vite 8.2.1 build and packaged CSP/asset smoke test |
| Companion art | Pass | all 9 premium packs; boundary-alpha, frame-density and frame-uniqueness validation; Midnight Cat square removed |
| Sound design | Pass with human acceptance pending | tested bark/purr/yip, snack, slurp, happy, sleep/wake and chime recipes; volume persists and Settings includes a direct preview |
| JavaScript audit | Pass | 0 known npm vulnerabilities |
| RustSec audit | Reviewed | 0 classified vulnerabilities; 17 allowed upstream warnings |
| Windows native runtime | Pass | responsive rc.4 executable, approximately 30 MB working set; transparent pet-only surface verified without a focus rectangle |
| Windows size control | Pass | accessibility tree exposes 65–200%; 150% produced a 288×288 pet window from the 192×192 base |
| Windows Settings | Pass | free/accountless message, play-request controls, sound volume/preview, Wellbeing, actions, tabs and creator attribution visible |
| Windows package | Pass | current x64 NSIS installer and SHA-256 manifest generated |
| Linux native runtime | Pass | rc.4 reached `Pet ready` and remained alive after 8 seconds under Xvfb/DBus |
| Linux packages | Pass | rc.4 x64 AppImage and `.deb`; Debian metadata identifies Sabin Raut |
| SBOM/checksums | Pass | CycloneDX web SBOM and SHA-256 manifests generated |
| macOS artifacts | Pass in CI | separate Apple Silicon and Intel DMGs, checksums and SBOMs built and uploaded; Developer ID signing/notarization and physical runtime acceptance remain external |

The Rust warnings are inherited primarily from Tauri's Linux GTK3/WebKitGTK
stack. `RUSTSEC-2024-0429` is explicitly documented in `audit.toml`; MyPerro
does not call the affected iterator API. The warnings remain upstream technical
debt and must be revisited when the desktop stack migrates.

## Requested behavior now implemented

- The desktop window contains no visible buttons, gear, or action dock. Only
  the pet remains, plus temporary speech and an active focus timer when needed.
- After clicking the companion, first-letter controls are F Feed, W Water,
  P Play, R Rest, and S Settings. They are deliberately scoped to the focused
  pet window so MyPerro never steals ordinary typing from other applications.
- Right-click and the tray remain mouse-only/accessibility fallback paths.
- “Ask to play” is optional and configurable from 5 to 240 quiet minutes; the
  default is 30 minutes and a new installation is not nagged immediately.
- A dog shows “Woof woof!” and plays a two-part bark every four seconds for at
  most 20 seconds. Cat companions use a matching meow/purr treatment.
- Petting, feeding, or playing immediately ends the request and its message.
  Quiet mode and disabling the setting also stop an active request.
- Rest is a real 60-second state. Touching the companion, feeding it, offering
  water, or starting play wakes it early; automatic wandering and cursor chase
  stay suspended while it rests.
- Feeding plays a snack cue, shows the food pose, then runs a three-second
  celebration dance. Water plays a slurp cue, shows the bowl only while
  drinking, then runs a happy shake. Reduced motion uses a calmer tail wag.
- Sound volume is adjustable from 10% to 100%; the Settings preview provides a
  direct user gesture so Windows, macOS and Linux webviews can unlock audio.
- Desktop size is continuously adjustable from 65% to 200%, is persisted, and
  the resized pet is clamped back onto the active monitor.
- Transient messages remain visible for 20 seconds by default, with explicit
  early dismissal for the interactions above.

## Production-grade areas

- Privacy is opt-in. The global activity listener does not start before consent,
  can be disabled immediately, aggregates only counts/geometry, and never
  serializes typed content or keycodes.
- Settings are native, auto-saving, corruption-recovering, schema-migrated, and
  local. Login launch uses Tauri's supported plugin.
- The app is single-instance, restores window state, logs bounded local
  diagnostics, and exposes a privacy-safe diagnostic export.
- Settings have task-based tabs, keyboard navigation, 44 px targets,
  reduced-motion support, a privacy tour, shortcut cards, and an explicit Done
  action. The desktop has no persistent gear; S, right-click, and the tray open
  Settings while the companion window is focused.
- Nine dog and cat characters share one validated native-resolution atlas
  pipeline with addressable typing, tail, walking, running, eating, drinking,
  sleeping, petting, jumping, and celebration frames.
- Release automation covers native builds, tests, dependency audits, pack
  validation, packaged-asset checks, SBOMs, checksums, and artifact upload. A
  previously skipped Linux dependency step is fixed, and macOS is split into
  Intel and Apple Silicon jobs.
- Original creator attribution is visible and embedded as **Sabin Raut** in the
  app, installer/package metadata, README, NOTICE, Cargo, and npm metadata.

## Critical product critique

| Area | Score | Honest assessment |
|---|---:|---|
| Core virtual-pet loop | 9.0 | Play requests, interruptible rest, persistent wellbeing and kind offline caps create attachment without punishing absence. Long-term progression and learned tricks remain shallow. |
| Reactive behavior | 9.0 | Cursor attention, drag, shake, pet, typing, scrolling, wander, sleep, reminders, requests and agent states are broad. Active-window perching and automatic video awareness remain absent. |
| Feature discoverability | 9.1 | The desktop is cleaner but less self-explanatory. First-run guidance, Settings shortcut cards, accessibility metadata, right-click and tray labels compensate without permanent controls. |
| Character art | 8.3 | Clean, transparent and consistent across nine companions; neutral poses are now prop-free and density-checked. It still uses fewer principal poses than bespoke commercial frame-by-frame production. |
| Motion quality | 8.5 | Anticipation/impact/recovery, a post-feed dance, post-water shake, eye follow and micro-motion read well. Live2D deformation and hand-authored transition continuity would be smoother. |
| Settings/accessibility | 9.0 | Clear information architecture, native keyboard tabs, auto-save status, range controls, reduced motion and large targets. Screen-reader/high-contrast audits still need real OS coverage. |
| Privacy/security | 9.3 | Local-only, narrow capabilities, restrictive CSP, consent, no account and no telemetry are excellent. Unsigned global-input software will still attract antivirus scrutiny. |
| Cross-platform engineering | 8.9 | One Tauri codebase, verified Windows/Linux packages, dual-architecture macOS CI. Native Wayland input is compositor-limited and macOS runtime acceptance is external. |
| Release operations | 7.5 | CI, reproducible Linux builder, runbook, SBOM, checksums and rollback guidance exist. Signing, notarization, updater hosting and clean-machine evidence remain unresolved. |
| Ecosystem | 6.2 | Validators and documentation exist, but there is no in-app pack importer, creator studio, or moderated catalog. |

## Competitive position

MyPerro is stronger than mascot-only competitors in privacy, feature visibility,
free/accountless distribution, Linux packaging, and built-in companion
interactions. It is broadly competitive with ComNyang's input-reaction and
productivity concept while being easier to audit because it is local-only.

Competitors remain ahead in three material areas:

1. ComNyang has a more mature commercial illustration/animation finish and
   more content-aware desktop behavior.
2. Live2D-style pets can deform continuously, producing smoother transitions
   than a sprite atlas.
3. VPet and creator-focused products have deeper progression and community
   ecosystems, including workshops and uploaded characters.

The next visual leap should be a commissioned animation pass with more unique
drawings and active-window physics, not another Settings redesign.

## Cross-platform truth table

| Platform | Verified here | Remaining acceptance |
|---|---|---|
| Windows 10/11 x64 | optimized rc.4 executable, NSIS, transparent pet-only runtime, single instance | Authenticode; clean-VM install/upgrade/uninstall; human audio acceptance and mixed-DPI matrix |
| Linux x64 X11/XWayland | optimized rc.4 executable, AppImage, Debian package, DBus/Xvfb launch | real GNOME/KDE tray, transparency, audio, scaling, sleep/resume and global-input sessions |
| Linux native Wayland | UI can launch | global reactions are compositor-dependent and must remain labelled degraded |
| macOS 12+ ARM64/Intel | separate ARM64 and Intel DMGs built in GitHub Actions | Accessibility flow, Developer ID signing, notarization, audio and physical hardware QA |

## Remaining stable-release gates

1. Supply a Windows code-signing certificate and Apple Developer ID/notarization
   secrets, then build and verify signed artifacts in CI.
2. Run the clean-machine matrix: Windows mixed DPI and sleep/wake; macOS Intel
   and Apple Silicon; GNOME and KDE on X11/XWayland. Confirm bark/meow volume,
   transparent click-through, tray behavior and one-minute rest with a clock.
3. Configure a real HTTPS update endpoint and Tauri updater signing key, test
   rollback, then enable the updater. Do not ship a fake endpoint or key.
4. Commission a frame-by-frame pass for typing, eating, drinking, tail arcs and
   pose transitions, with silhouette review at every supported scale.
5. Add a signed/validated in-app companion-pack importer before advertising a
   public community ecosystem.
6. Decide whether crash reporting remains absent for maximum privacy or becomes
   an explicit opt-in service; document retention before adding one.
7. Pin CI actions to reviewed commit SHAs and produce a native Rust SBOM in
   addition to the existing web CycloneDX report.

## Go/no-go

- **Go now:** free public beta on Windows and Linux, clearly labelled as an
  unsigned release candidate and accompanied by checksums.
- **Conditional go:** Linux stable after real GNOME/KDE testing.
- **No-go for stable:** broadly promoted stable release until Windows signing,
  macOS signing/notarization, physical-platform QA, and an update/rollback
  channel are complete.
