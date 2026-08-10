# ComNyang → MyPerro Feature Parity

Every one of ComNyang's 18 advertised motions, mapped to its dog equivalent, with an honest build status. Scraped from comnyang.com on 9 Aug 2026. These are behaviours, not copied assets — we reproduce what the cat *does*, in an original dog of our own.

Legend: ✅ built & verified locally · 🎨 prototype art exists, final animation art still needed · 🧩 integration still needs external QA · ⬜ not started

| # | ComNyang | MyPerro equivalent | Status |
|---|---|---|---|
| 1 | Your cat's pattern (custom mapping) | Fur colour + marking mask, "match your real dog" | ✅ six breeds + runtime fur/marking/collar recolour; full mask painter is post-beta |
| 2 | Eye follow | Puppy pupils track cursor | ✅ renderer-level eye follow |
| 3 | Mochi drag (stretch + shake wobble) | Pick up, dangle, shake-wobble | ✅ drag + shake detector |
| 4 | Mouse hunt | Chase a fast cursor | ✅ `chase`, sustained 200 ms |
| 5 | Purring pets | Head rub → happy + tail wag | ✅ `pet`, 3 strokes / 1.5 s + sound cue |
| 6 | Keyboard kneading | Paw at a tiny keyboard | ✅ `typing` |
| 7 | Overheat mode | Pant + steam when typing hard | 🎨 `type_intense` + `pant` prototype art |
| 8 | Stretch reminder | Downward-dog stretch on a timer | ✅ scheduler + reminder art mapping |
| 9 | Drink-water reminder | Trot to a bowl on a timer | ✅ scheduler + `drink` art mapping |
| 10 | Paper unroll (on scroll) | Pull a sock / leash on scroll | 🎨 `scroll` logic; final prop animation needed |
| 11 | Thinking along (AI agent) | Head-tilt think while agent works | ✅ local `agent-status.json` bridge |
| 12 | Agent done jump | Happy hop + bark | ✅ `agent` done + sound cue |
| 13 | Pomodoro timer | Pixel clock beside the dog | ✅ scheduler + clock + tray toggle |
| 14 | Message reminder | Barks at a chosen time + message | ✅ settings UI + scheduler wiring |
| 15 | Fixed message | Pinned note above the head | ✅ settings + live update |
| 16 | Tell your name | Uses your name in reminders | ✅ settings + personalization |
| 17 | Multi-device license | — (free & open source, no license) | n/a by design |
| 18 | Peek mode | Peek from screen edge and stay out of the way | ✅ manual settings + tray toggle; video/fullscreen auto-detection is post-beta |

**Extra life:** MyPerro now adds autonomous idle motions — blink, tail wag, look-up, scratch, yawn and sit-side variety — so the dog does not freeze when the user is quiet.

**Current state:** MyPerro now matches the 18 public ComNyang behaviours in original dog form, except #17, which is intentionally not a product feature because MyPerro is free and open source. A few behaviours still have prototype art instead of hand-authored multi-frame animation, but the product paths are wired and locally verified.

Two we can do *better* than the reference:
- **Privacy is verifiable**, not just claimed — keycodes never leave Rust.
- **Reduced-motion mode** — ComNyang has no accessibility alternative; every MyPerro state does.
