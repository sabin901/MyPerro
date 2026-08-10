# Running MyPerro

## Prerequisites

```bash
node --version   # Node 18+
cargo --version  # Rust toolchain
```

On macOS, install Xcode command line tools if Rust or Tauri asks for them:

```bash
xcode-select --install
```

## Start The App

```bash
npm install
npm run art:dogs
npm run start
```

The first native build can take a few minutes. Later runs are usually fast.

macOS will ask for Accessibility permission. Grant it in System Settings,
Privacy & Security, Accessibility, then restart MyPerro. If permission is not
granted, the puppy still runs and can be dragged, but it cannot react to cursor,
typing, petting, or scroll input.

## Desktop QA Checklist

Press `h` while the pet window is focused to toggle the diagnostics overlay.

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
| Quiet mode | Tray toggle pauses reminders without losing scheduled messages |
| Peek mode | Tray/settings park the puppy at the screen edge |
| Idle life | Leave the puppy alone and it blinks, wags, tilts, side-eyes, pants, scratches, yawns, and gently wanders |
| Permission denied | App stays usable and overlay reports degraded mode |

## Change The Dog

Right-click the puppy or open `Settings...` from the tray. In `Appearance`,
click a breed card. The puppy name, breed, colors, marking style, and preview
change together. Fine-tune the fur/marking/collar colors if you want, then press
`Save`. The desktop puppy updates immediately after saving.

## AI-Agent Bridge

MyPerro polls a local `agent-status.json` file in its app config directory. Write:

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
for d in art/exported/*; do npm run validate-pack "$d"; done
```

The only expected warning today is a Rust future-compatibility notice from the
transitive `block` crate.
