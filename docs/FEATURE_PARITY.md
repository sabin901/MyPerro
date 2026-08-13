# ComNyang → Pawi Feature Parity

Every one of ComNyang's 18 advertised motions, mapped to its dog equivalent, with an honest build status. Scraped from comnyang.com on 9 Aug 2026. These are behaviours, not copied assets — we reproduce what the cat *does*, in an original dog of our own.

Legend: ✅ built & verified locally · 🎨 prototype art exists, final animation art still needed · 🧩 integration still needs external QA · ⬜ not started

| # | ComNyang | Pawi equivalent | Status |
|---|---|---|---|
| 1 | Your cat's pattern (custom mapping) | Fur colour + marking mask, "match your real dog" | ✅ six breeds + runtime fur/marking/collar recolour; full mask painter is post-beta |
| 2 | Eye follow | Puppy attention follows cursor | ✅ pointer-facing posture; source-authored premium eyes are preserved instead of drawing generic square pupils |
| 3 | Mochi drag (stretch + shake wobble) | Pick up, dangle, shake-wobble | ✅ detector + dangling cel + squash/stretch/rotation |
| 4 | Mouse hunt | Chase a fast cursor | ✅ sustained chase + alternate run cel + speed/dust effects |
| 5 | Purring pets | Head rub → happy + tail wag | ✅ stroke detector + alternating happy cel + floating hearts + sound |
| 6 | Keyboard kneading | Paw at a tiny keyboard | ✅ alternating paw cels + animated key flashes |
| 7 | Overheat mode | Pant + steam when typing hard | ✅ rapid paw cels + heat tint + three animated steam plumes |
| 8 | Stretch reminder | Downward-dog stretch on a timer | ✅ scheduler + reminder art mapping |
| 9 | Drink-water reminder | Trot to a bowl on a timer | ✅ scheduler + bowl cel + animated water droplets |
| 10 | Paper unroll (on scroll) | Unroll a paper strip on scroll | ✅ alternating paper cels + moving paper wave |
| 11 | Thinking along (AI agent) | Head-tilt think while agent works | ✅ local bridge + animated thinking dots |
| 12 | Agent done jump | Happy hop + bark | ✅ jump/tail sequence + squash/stretch + sparkles + sound |
| 13 | Pomodoro timer | Pixel clock beside the dog | ✅ scheduler + clock + tray toggle + animated focus ring |
| 14 | Message reminder | Barks at a chosen time + message | ✅ settings UI + scheduler wiring |
| 15 | Fixed message | Pinned note above the head | ✅ settings + live update |
| 16 | Tell your name | Uses your name in reminders | ✅ settings + personalization |
| 17 | Multi-device license | — (free & open source, no license) | n/a by design |
| 18 | Peek mode | Peek from screen edge and stay out of the way | ✅ persistent `N`/Settings/tray toggle + privacy-safe automatic known-video-app detection |

**Extra life:** Pawi adds autonomous idle motions — blink, tail wag, look-up,
scratch, yawn and sit-side variety — plus animated sleep glyphs and state-specific
particles and video-aware edge peeking, so the dog does
not freeze when the user is quiet.

**Current state:** Pawi matches the 18 public ComNyang behaviours in original
companion form, except #17, which is intentionally not a product feature because
Pawi is free and open source. Each of the nine companions now has a premium
192px sheet with 16 key silhouettes, alternating work/walk/tail/petting cels,
state-specific choreography, and a complete animation-tour control in Settings
and the native tray.

Two we can do *better* than the reference:
- **Privacy is verifiable**, not just claimed — keycodes never leave Rust.
- **Reduced-motion mode** — ComNyang has no accessibility alternative; every Pawi state does.
