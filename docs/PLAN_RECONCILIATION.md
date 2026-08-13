# Master Plan Reconciliation

The Master Program Plan is now the governing document. This records what changed in the code to match it, and the three places the plan needs a decision from you.

---

## Adopted from the plan

| Plan section | Was | Now |
|---|---|---|
| §9.3 sprite cell | 64 × 64 | **96 × 96**, body ~64 px inside the cell |
| §9.3 display scale | 3× | **2×** |
| §13.3 calm idle | 20 s | **60 s** |
| §13.3 sleepy | — (didn't exist) | **5 min**, distinct state |
| §13.3 asleep | 2 min | **10 min** |
| §13.3 alert | 350 px/s | **600 px/s** |
| §13.3 chase | 1400 px/s | **1200 px/s** |
| §13.3 typing | >0 keys per batch | **≥2 keys/sec** |
| §13.3 intense typing | >6 keys per batch | **≥8 keys/sec** |

The placeholder atlas has been regenerated at 96 × 96 with the dog sized to 64 px tall, and all 26 unit tests re-run green against the new contract.

**One conversion worth noting:** the plan states typing thresholds in *keys per second*, but the Rust snapshot reports *keys since the last batch*. Those are only the same number if the batch rate never changes — and §12 explicitly asks for a variable rate. So the conversion now happens in one place, `keysPerSecond()`, which means changing the snapshot rate can't silently change how the dog feels.

**Sleepy vs asleep exposed a real gap.** The plan wants three distinct rest states; my code had two, and mapping both sleepy and asleep to the `sleep` frame made a test fail. Sleepy now holds the calm-idle pose but drops to the 3 fps sleeping budget — visually subtle, nearly free to render. There's a test asserting all three states stay distinct.

---

## Three things the plan needs from you

**1. The 224 px window figure doesn't follow from the other numbers.** §9.3 says a 96 px cell at 2× default scale, then gives 224 × 224 as the default window. 96 × 2 = 192. I've built to 192 and treated 224 as a typo — but if 224 was deliberate (32 px of padding for effects that overflow the sprite bounds, say) then the atlas cell should be 112, and that needs to be settled *before* the artist starts.

**2. The plan and the artist brief now disagree, and the brief hasn't gone out.** The brief specifies 64 × 64. The plan specifies 96 × 96. I've updated the code but not yet the brief, because 96 × 96 with a 64 px body means the artist is drawing at a larger canvas with deliberate headroom — that's a different quote and a different amount of work. Confirm 96 and I'll update `ARTIST_BRIEF.md` and `ART_GUIDE.md` to match before you send them.

**3. §12's variable snapshot rate isn't implemented yet.** The Rust pump is still a fixed 15 Hz. The plan wants 15 Hz active, 5 Hz calm, 1 Hz asleep, 0 Hz hidden. This is a genuine CPU win — at 1 Hz while asleep the app does almost nothing — and it's Phase 1 work, since idle CPU is a Phase 1 exit criterion. I'd rather implement it than measure a number we already intend to change.

---

## Plan requirements not yet built, and where they land

| Plan section | Requirement | Phase |
|---|---|---|
| §9.4 | One tested coordinate module; no scattered DPI maths | 1 — currently inline in `boot()` |
| §12 | Variable snapshot rate | 1 |
| §12 | Pointer region: head / body / tail / transparent | 2 |
| §13.1 | Entry / loop / exit animations, min & max duration, cooldown | 2 |
| §13.2 | Full 12-level priority ladder | 2 |
| §13.3 | Chase requires 1200 px/s sustained 200 ms; petting = 3 strokes in 1.5 s; shake = 3 reversals in 800 ms | 2 |
| §13.4 | Watchdog returning unknown states to idle | 2 |
| §13.5 | Breed personalities | 4 |
| §11.4 | Windows SmartScreen / antivirus trust | 5 |

The current `decide()` is a flat priority chain with no timing, hysteresis or cooldowns. That's adequate for a spike and inadequate for the plan — §13.1's full behaviour record is the Phase 2 rewrite, and `behaviour.ts` is deliberately shaped to grow into it.

---

## Note on the plan file itself

`PAWI_MASTER_PROGRAM_PLAN.md` is 2,401 lines and lives in the chat upload area, which sits outside the folder I can write binaries or large files into. **Please drag it into `~/Desktop/Pawi/docs/`** so it's version-controlled alongside everything else. I've read and reconciled against it either way.
