# MyPerro

An open-source virtual pet that watches your cursor, reacts to your work,
reminds you to take breaks, asks to play, and quietly keeps you company.

**Created by Sabin Raut.**

macOS · Windows · Linux (X11/XWayland) · MIT licensed · open source · no telemetry · no account

**Website and downloads:** https://sabin901.github.io/MyPerro/

## What It Does

- Pixel puppy overlay with transparent click-through hit testing.
- Persistent virtual-pet wellbeing: fullness, hydration, happiness, and energy.
- Pet-only desktop surface with no overlay buttons or action dock.
- Focused-pet controls: `F` Feed, `W` Water, `P` Play, `R` Rest, `N` Peek,
  `D` Dance, `T` Typing, `B` Bark/meow, `J` Jump, and `S`
  Settings. They never register as system-wide letter shortcuts.
- Native-resolution premium atlas support shared by Windows, macOS, and Linux builds.
- First-run privacy tour before input reactions are enabled, native reminders,
  rotating local logs, and a privacy-safe diagnostic export.
- Gentle food, water, play, and rest interactions with distinct cute sounds;
  feeding ends in a happy dance and drinking ends in a celebratory shake;
  needs never reach zero and offline decay is capped to avoid punishment.
- Optional play reminders: after the chosen quiet period the puppy says
  “Woof woof!” for up to 20 seconds, then stops as soon as it is touched, fed,
  or played with. Cats use a matching meow.
- Rest lasts one minute and can be ended early by touching the companion.
- Nine built-in companions: Shiba Inu, Pomeranian, Husky, German Shepherd,
  Dalmatian, Lhasa Apso, Calico Cat, Midnight Cat, and Cream Tabby.
- Cursor chase, eye follow, petting, dragging, shaking, scrolling, typing, hard
  typing, continuous free roaming, playful rolling, idle micro-motions, sleeping,
  waking, stretch, water, notes, and Pomodoro reactions.
- Privacy-safe edge-peek behavior for known video players/browser video pages.
  Only the coarse `none`/`video` result reaches the UI; titles, URLs and audio
  do not.
- Cryptographically signed in-app updates from the official GitHub release
  channel. Published builds check automatically and installation remains a
  user-confirmed action in Settings.
- Task-based, auto-saving settings for names, reminders, scheduled messages,
  quiet hours, Pomodoro, breed, 65–200% size, opacity, colours, markings, sound
  volume and preview, reduced motion, always-on-top, start at login, and peek mode.
- Tray controls for show/hide, play, Pomodoro, quiet mode, peek mode, settings,
  feeding, water, rest, and quit.
- Local AI-agent bridge through `agent-status.json` for `thinking`, `done`, and
  `error` reactions.
- Community dog-pack validator.

## Run

```bash
npm install
npm run art:dogs
npm run start
```

macOS may ask for Accessibility permission so MyPerro can read cursor and input
counts. It never stores or emits keycodes; only counts and geometry leave Rust.
On Linux, global input reactions work with X11/XWayland; native Wayland can
block global input by design. Settings → App shows a live compatibility check.

## Check

```bash
npm run typecheck
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run validate:packs
npm run smoke:dist
```

## Change Your Companion

Open Settings by clicking the pet and pressing `S`, using the tray menu, or
right-clicking the companion, then use the
`Companion` tab:

1. Click a breed card.
2. The puppy name, breed, colors, marking style, and preview update together.
3. Fine-tune `Base colour`, `Markings`, `Marking style`, and `Collar`.
4. Changes save automatically; use `Save now` for confirmation and `Done` to
   return to the desktop pet.

## AI-Agent Bridge

Write this file in MyPerro's app config directory as `agent-status.json`:

```json
{
  "status": "thinking",
  "message": "{name}, your agent is working",
  "updatedAt": 1786320000000
}
```

Supported statuses are `thinking`, `done`, and `error`. `message` is optional.
`{name}` is replaced with the owner's name from settings.

## Docs

| File | What it's for |
|---|---|
| `docs/FEATURE_PARITY.md` | ComNyang-inspired parity tracker |
| `docs/PHASES.md` | Project phases and exit criteria |
| `docs/PRD.md` | Product scope |
| `docs/ART_GUIDE.md` | Pixel-art rules |
| `docs/pack-format.md` | Community dog-pack format |
| `docs/EVALUATION.md` | Current verification, critique, and release gates |
| `docs/COMPETITIVE_REVIEW.md` | Product comparison and next investments |
| `docs/RELEASE.md` | Signing, packaging, QA, updater and rollback runbook |

## Licence

Copyright © 2026 Sabin Raut. Code: MIT. Built-in generated artwork: CC BY 4.0.
Third-party companion packs declare their own licences. See `NOTICE.md`.
