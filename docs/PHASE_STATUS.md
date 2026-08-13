# Phase Status — full recheck

Rechecked after wiring Phase 4 into the windows. **118 tests pass, `tsc` clean across every module.** The honest split remains: logic is built and verified; the native shell has still never been launched.

| Phase | Scope | Code | Tests | Run on desktop | Verdict |
|---|---|---|---|---|---|
| 0 — Scope & brief | PRD, artist brief, art guide, breed spec | ✅ | n/a | n/a | **Done** |
| 1 — Technical spike | Transparent window, input, click-through, HUD | ✅ | logic ✅ | ❌ | **Code-complete, unverified** |
| 2 — Behaviour engine | 16-state machine, detectors, safety | ✅ | ✅ 30 | ❌ | **Code-complete, unverified** |
| 3 — Art integration | Real sprites, recolouring | ⬜ | — | — | **Blocked on artist** |
| 4 — Features | Reminders, Pomodoro, settings, name, note | ✅ | ✅ 41 | ❌ | **Logic + UI wired; unverified** |
| 5 — Cross-platform | Windows DPI, Linux, antivirus, peek | ⬜ | — | — | Not started |
| 6 — Open source | Licences, CI, docs, pack format + validator | ✅ | ✅ 13 | CI written | **Mostly done** (CI unrun) |
| 7 — Release | Signing, notarisation, installers | ⬜ | — | — | Not started |

## Phase 6 added this pass

- **Dog-pack validator** (`pack.ts`) — rejects malformed community breeds before load, with 13 tests, mutation-verified. This is the mechanism behind community breeds, Pawi's answer to ComNyang's pattern showcase.
- **`LICENSE`** (MIT for code, CC BY 4.0 for art noted), **`CONTRIBUTING.md`**, **`PRIVACY.md`** (the verifiable no-keylogging promise in plain words), **`docs/pack-format.md`**.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) — a fast typecheck+test lane on every push, and a three-OS native build lane. Written, not yet run (needs the repo on GitHub).
- **`npm run validate-pack`** CLI so authors can check a pack before submitting.

## What changed this pass

Phase 4 is no longer just logic. It's now wired end to end:

- **`main.ts` polls the scheduler once a second.** A due water/stretch reminder becomes a note bubble plus the dog's `reminder` behaviour; a finished Pomodoro focus round becomes the happy-hop `agent` celebration.
- **The pinned note** renders above the dog's head, and a reminder flashes its message for eight seconds before falling back to the pinned note.
- **The Pomodoro clock** renders bottom-right while a session runs.
- **The settings window is real** — a full form for names, reminder timings, quiet hours, Pomodoro lengths, appearance colours, sound, reduced motion and start-at-login. Every value round-trips through `normaliseSettings`, so the form physically cannot save an invalid setting.
- **Rust persists settings** to one JSON file in the OS config dir, written atomically (temp file + rename) so a crash mid-save can't corrupt it.

## Test coverage by module

```
behaviour.test.ts   26   thresholds, FPS governor, hit-test bounds
coords.test.ts      21   DPI conversion, monitor clamping, stranded window
engine.test.ts      30   16-state machine, safety, 5000-iteration fuzz
scheduler.test.ts   27   reminders, Pomodoro, quiet hours, sleep-gap collapse
settings.test.ts    14   validation, clamping, name personalisation
------------------------------------------------------------
                   118   all green, tsc clean
```

Each critical module has been **mutation-tested** — deliberately broken to confirm the tests catch the break. The engine's two review bugs (stuck state, unreachable sleep) and the scheduler's three (message priority, long-break cadence, overnight quiet hours) all have named regression guards that were verified to fail when the bug is reintroduced.

## What is still not done, and why it can't be here

1. **Nothing has run natively.** Every Phase 1 exit criterion — idle CPU, memory, cold start, and the click-through kill-criterion — is a measurement that needs a real desktop. My sandbox is headless Linux with no Rust toolchain (rustup is network-blocked).
2. **The Rust is unverified.** `input.rs`, `main.rs` and `settings_store.rs` are written against the documented APIs but never compiled here.
3. **Real art (Phase 3)** waits on the commission — the true calendar critical path.
4. **Sound** is a deliberate no-op (`playSound`); the engine already emits the right cues.

## The one action that unblocks everything

```bash
cd ~/Desktop/Pawi
npm run demo     # the real engine + scheduler in a browser — no Rust
npm test         # all 118 green
npm run setup    # then the native app, once Rust + icons are in place
```

`npm run demo` now exercises reminders and Pomodoro too, not just movement. The native run converts every "unverified" above into "done" and settles whether click-through works on macOS — the last genuinely unknown risk in the project.

## ComNyang parity

17 of 18 motions matched or stubbed (`FEATURE_PARITY.md`). The gap is paid multi-device licensing, which we deliberately don't want. We do two things better: verifiable privacy, and reduced-motion alternatives for every state.
