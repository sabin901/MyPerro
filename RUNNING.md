# Running Pawi

## Prerequisites

```bash
node --version   # Node 20.19+
cargo --version  # Rust toolchain
```

On macOS, install Xcode command line tools if Rust or Tauri asks for them:

```bash
xcode-select --install
```

On Debian/Ubuntu Linux, install the native Tauri, tray, and X11 dependencies:

```bash
sudo apt update
sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev libxtst-dev
```

Linux support currently targets X11 and XWayland. Native Wayland may run in
degraded mode because global cursor and input monitoring is compositor-limited.

## Start The App

```bash
npm install
npm run art:dogs
npm run start
```

The first native build can take a few minutes. Later runs are usually fast.

macOS will ask for Accessibility permission. Grant it in System Settings,
Privacy & Security, Accessibility, then restart Pawi. If permission is not
granted, the puppy still runs and can be dragged, but it cannot react to cursor,
typing, petting, or scroll input.

## Desktop QA Checklist

The desktop window contains only the pet. Click the companion to focus it, then
use its action's first letter: `F` Feed, `W` Water, `P` Play, `R` Rest, and `S`
Settings. Right-clicking opens Settings as a mouse-only alternative.

For developer diagnostics, press `Ctrl+Shift+H` while the pet is focused.

| Check | Target |
|---|---|
| Idle CPU | Under 1% after the dog settles |
| Memory | Under 100 MB |
| Cold start | Puppy visible within 2 seconds after warm build |
| Click-through | Clicks pass through transparent pixels and stop on the dog |
| Drag | Smooth movement, no stuck click-through state |
| Settings | Breed, colour, note, reminders, scheduled message, sound, and peek save live |
| Pomodoro | Tray toggle starts/stops the pixel clock |
| Play | Tray `Play with puppy` triggers zoomies |
| Virtual pet | Fullness, hydration, happiness, and energy persist between runs |
| First letters | F/W/P/R trigger matching actions; S opens Settings; no desktop buttons are visible |
| Requests | Low needs produce a gentle bubble and beg/drink/sleep reaction without blocking work |
| Quiet mode | Tray toggle pauses reminders without losing scheduled messages |
| Peek mode | Tray/settings park the puppy at the screen edge |
| Idle life | Leave the puppy alone and it blinks, wags, tilts, side-eyes, pants, scratches, yawns, and gently wanders |
| Permission denied | App stays usable and overlay reports degraded mode |

## Change The Companion

Click the pet and press `S`, right-click the companion, or open `Settings...`
from the tray. In `Companion`, click a breed card. The name, breed, colors, marking
style, and preview change together. Changes save automatically; choose `Done`
to restore the desktop pet.

## AI-Agent Bridge

Pawi polls a local `agent-status.json` file in its app config directory. Write:

```json
{
  "status": "thinking",
  "message": "{name}, your agent is working",
  "updatedAt": 1786320000000
}
```

Use `thinking`, `done`, or `error`. `done` and `error` are consumed after the
puppy reacts; `thinking` remains active until another status replaces it.

## Verify Before Shipping

```bash
npm run typecheck
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run validate:packs
npm run smoke:dist
```

Review `cargo audit` against `audit.toml`. The currently allowed warnings are
documented upstream Linux GTK3/WebKitGTK dependencies and must be revisited when
Tauri's Linux stack migrates.
