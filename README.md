# MyPerro

An open-source desktop puppy that watches your cursor, reacts to your work,
reminds you to take breaks, and quietly keeps you company.

macOS · Windows · Linux experimental · MIT licensed · no telemetry · no account

## What It Does

- Pixel puppy overlay with transparent click-through hit testing.
- Six built-in dog breeds: Shiba Inu, Pomeranian, Husky, German Shepherd,
  Dalmatian, and Lhasa Apso.
- Cursor chase, eye follow, petting, dragging, shaking, scrolling, typing, hard
  typing, idle micro-motions, sleeping, waking, stretch, water, notes, and
  Pomodoro reactions.
- Settings for names, reminders, scheduled message, quiet hours, Pomodoro,
  breed, fur/marking/collar colours, marking style, sound, reduced motion,
  start at login, and peek mode.
- Tray controls for show/hide, play, Pomodoro, quiet mode, peek mode, settings,
  and quit.
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

## Check

```bash
npm run typecheck
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
for d in art/exported/*; do npm run validate-pack "$d"; done
```

## Change Dogs

Open settings from the tray menu or right-click the puppy, then use
`Appearance`:

1. Click a breed card.
2. The puppy name, breed, colors, marking style, and preview update together.
3. Fine-tune `Base colour`, `Markings`, `Marking style`, and `Collar`.
4. Press `Save`.

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

## Licence

Code: MIT. Built-in generated artwork: CC BY 4.0. Third-party dog packs declare
their own licences.
