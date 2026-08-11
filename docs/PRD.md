# MyPerro — Product Requirements (Alpha, frozen)

**Status:** frozen 8 August 2026. Changes require explicitly unfreezing, and every addition must be traded against something already on the list.

## The promise

> An open-source desktop puppy that watches your cursor, reacts to your work, reminds you to take breaks, and quietly keeps you company — without spying on you or slowing your computer down.

If a feature doesn't serve that sentence, it isn't in v1.

## Who it's for

Someone who spends all day at a computer, works alone or remotely, and wants their desktop to feel less sterile. Mildly productivity-curious but not obsessive — they'll use a Pomodoro timer if it's *there*, but they didn't come for it. A meaningful slice are developers, which is why coding-agent reactions matter later, but the app must delight someone who has never opened a terminal.

They will uninstall immediately if it makes their fan spin, and refuse to install if the permission prompt feels creepy. Both are product requirements.

## Platforms

| Platform | v1 status |
|---|---|
| macOS 12+ Apple Silicon | Fully supported |
| macOS 12+ Intel | Supported |
| Windows 10 / 11 x64 | Fully supported |
| Linux X11 / XWayland | Experimental |
| Linux native Wayland | Degraded, documented |
| Windows ARM, mobile | Not supported |

## In scope for alpha

**The dog** — one breed, Shiba Inu. Idle breathing, blinking, sitting, lying, sleeping, waking. Walking and running both directions. Tail wag, head tilt, stretch, yawn. Follows the cursor with eyes and ears. Chases a fast cursor. Paws at the keyboard when you type, pants when you type hard. Sleeps when you're idle, greets you when you return. Draggable, and reacts to being picked up. Pettable, and reacts happily.

**Utility** — Pomodoro with a pixel clock beside the dog. Stretch reminder. Water reminder. One pinned note. Tray menu (show/hide, start focus, quiet mode, settings, quit). Settings window. Start at login. Global mute. Position remembered per monitor.

**Trust** — onboarding explaining the input permission in plain language before requesting it. A working degraded mode if refused. Reduce-motion mode. No telemetry, no account, no network calls at rest.

**Customisation** — fur colour and marking-pattern mapping ("match your real dog"). Collar colour. The dog's name, and yours, for personalised reminders.

## Explicitly excluded from alpha

Longer than the include list, by design. Each is a real temptation that would cost the ship date.

Multiple pets on screen · accounts, cloud sync, online gallery · plugin SDK · AI chat, voice, or an LLM in the app · pet death or punitive offline decay · achievements, levels, streaks · task list or notes beyond the single pinned note · arbitrary window climbing · payment or licensing · mobile apps · Steam, Mac App Store, Microsoft Store.

## Acceptance criteria

1. Sustained idle CPU below 1%, memory below 100 MB, cold start below 2 seconds.
2. Clicking a transparent part of the pet window reaches the app underneath.
3. No keystroke content is ever read, stored, logged or transmitted — verifiable in source.
4. Refusing the input permission leaves a working app, not a broken one.
5. The dog cannot get stuck; every behaviour has an exit.
6. Multi-monitor connect/disconnect and sleep/wake don't strand the dog.
7. Someone can install it and understand it without instructions.
8. A 30-second screen recording is genuinely charming. If it isn't, the app isn't ready regardless of the other seven.

## Privacy commitments

Product promises that constrain the architecture:

- Keyboard input observed only as **counts and timing**. Keycodes discarded at capture in Rust, before crossing to the frontend.
- Mouse observed as **position and velocity** only.
- No window titles, clipboard, screenshots, URLs or file paths.
- No analytics, no crash telemetry, no network requests except explicit update checks.
- Everything stored locally in plain readable files the user can inspect and delete.

The product depends on being trusted with an input-monitoring permission. One violation ends it.

## Success metrics for the alpha

Not downloads. Does anyone leave it running more than a day? Does anyone report high CPU? Does anyone refuse the permission, and why? Does anyone ask for a specific breed? Does anyone file a detailed bug report?
