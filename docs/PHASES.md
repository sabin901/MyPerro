# Pawi — Phase Plan

Project name: **Pawi** (provisional — see naming risk in README).
Start date: 8 August 2026. Target public beta: mid-September 2026.

**Rule of engagement:** one phase at a time. At the end of each phase I self-check against that phase's exit criteria, report what passed and what didn't, and stop. Nothing from a later phase gets pulled forward.

---

## Phase 0 — Scope freeze & artist commission ✅ complete

Stop researching; get the long-lead item (artwork) moving in parallel.

**Delivered:** `PHASES.md`, `PRD.md`, `ARTIST_BRIEF.md`, `breed-options.md`, `ART_REFERENCE_ASSESSMENT.md`, project repository at `~/Desktop/Pawi`.

**Exit criteria** — alpha list frozen ✅ · exclusion list longer than inclusion list ✅ · artist brief quote-ready ✅ · atlas contract locked ✅ · project has a real home ✅

**Still blocked on you:** send the brief to artists, resolve the name conflict, initialise git.

---

## Phase 1 — Technical spike

The most important phase. Answers what reading cannot. Deliberately ugly — a coloured rectangle stands in for the dog.

**Build**

- Tauri 2 project, macOS + Windows targets
- Transparent, frameless, always-on-top pet window
- Click-through toggle and per-pixel hit testing
- Global cursor tracking via Rust
- Global keyboard *activity* detection — counts only, never keycodes
- Event aggregation in Rust, batched to the frontend at ~15 Hz
- Canvas 2D render loop with an FPS governor
- Live performance HUD: CPU, memory, FPS, event rate

**Exit criteria** — measured, not estimated:

- Idle CPU below 1%, sustained 30 minutes
- Memory below 100 MB
- Cold start below 2 seconds
- Clicks pass through transparent regions
- Dragging is smooth, no visible lag
- Survives second monitor connect/disconnect
- Survives sleep/wake
- Both platforms build from one source

**Kill criteria:** if per-pixel click-through can't work acceptably on both platforms, stop and reconsider the architecture before writing more code. Highest-risk item in the project.

**You run the builds.** My shell is an isolated Linux sandbox — I can write every line but cannot execute a Tauri app on your Mac or measure its CPU.

---

## Phase 2 — Behaviour engine

Decides whether the dog feels alive. Still no real art.

- Deterministic state machine: priorities, cooldowns, interruptibility
- Activity thresholds (idle → sleepy → asleep; cursor velocity → alert → chase; typing rate → paws → panting)
- Animation controller driven by the Phase 0 atlas contract
- Full behaviour specification table, written before the code
- Unit tests for every transition

**Exit criteria:** every transition tested; placeholder demonstrably responds to real input; no state can get stuck.

---

## Phase 3 — Art integration

Runs when the artist delivers. Code already waiting.

- Aseprite → atlas export pipeline, scripted
- Atlas + JSON loader, layer compositing, palette-indexed recolouring
- Marking-mask customisation ("match your real dog")
- Alpha hit-mask generated from the sprite
- Asset validator rejecting malformed packs

**Exit criteria:** swapping in a new dog is a file drop, not a code change.

---

## Phase 4 — Features & settings

- Tray menu, settings window, onboarding and permission flow
- Pomodoro, stretch reminder, water reminder, scheduled message, pinned note
- Quiet hours, fullscreen hiding, peek mode
- Sound with global mute, start-at-login, per-monitor position persistence
- Reduce-motion accessibility mode

**Exit criteria:** a stranger can install it, grant permissions and use it without being told anything.

---

## Phase 5 — Cross-platform hardening

- Windows: DPI at 100/125/150/200%, taskbar edges, SmartScreen
- Linux: X11 and XWayland, AppImage and .deb, Wayland degraded and labelled experimental
- Multi-monitor with mixed scaling
- **The antivirus problem:** a global keyboard hook in an unsigned binary looks exactly like a keylogger to Defender. Tested here, not discovered at launch.

**Exit criteria:** an honest documented support matrix.

---

## Phase 6 — Open-source readiness

- MIT code, CC BY 4.0 art
- README, CONTRIBUTING, SECURITY, PRIVACY, CODE_OF_CONDUCT, ROADMAP
- Dog-pack format docs and validator
- GitHub Actions CI for all three platforms
- Issue/PR templates, good-first-issue labels

**Exit criteria:** someone who has never spoken to you can build it and submit a dog pack.

---

## Phase 7 — Release

- macOS: Developer ID signing, notarisation, stapling, DMG
- Windows: signed installer, updater artifacts
- Linux: AppImage and .deb
- Signed auto-updates, checksums, rollback
- Demo video, landing page, launch channels

**Exit criteria:** installers that don't scare users, and a video that makes people want it.

---

## Parallel tracks

1. **Art** — commissioned in Phase 0, delivered around Phase 3.
2. **Name, domain and trademark screening** — must resolve before Phase 6.
3. **Sound** — not yet scoped. Needs a decision by Phase 4.

---

## Timeline

| Phase | Working time | Calendar |
|---|---|---|
| 0 | 1 day | 8 Aug ✅ |
| 1 | 3–5 days | 9–14 Aug |
| 2 | 1–1.5 weeks | 15–24 Aug |
| 3 | 4–6 days, gated by artist | late Aug |
| 4 | 1–1.5 weeks | late Aug – early Sep |
| 5 | 1 week | early–mid Sep |
| 6 | 3–4 days | mid Sep |
| 7 | 1 week | mid–late Sep |

Public alpha realistic around **25 August**; beta **mid-September**. Assumes the artist delivers on time and Phase 1 doesn't hit kill criteria.
