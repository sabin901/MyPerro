# Phase 1 close-out & Phase 2 report

**77 tests passing across 3 files. `tsc --noEmit` clean.** Everything below was executed, not asserted.

---

## Phase 1 — remaining items, now done

### §9.4 — one coordinate module

`src/pet/coords.ts`. All DPI and space conversion funnels through here: physical ↔ logical ↔ window-local ↔ sprite pixel, plus monitor clamping and stranded-window detection. 21 tests.

Two things it fixes that were latent bugs:

**Velocity thresholds were never scale-normalised.** The plan states chase as 1200 logical px/s, but `rdev` reports physical pixels. On a Retina display the threshold fired at half the intended real-world speed; on a 1× external monitor at double. The dog would have felt twitchy on the laptop and sluggish on the external screen — the classic bug that only appears when someone plugs in a second display. `normaliseVelocity()` now converts, and there's a test asserting the same physical hand movement crosses the threshold identically on 1× and 2×.

**`safeScale()` guards against a zero or NaN scale factor.** A momentary bad value during a monitor hot-plug would otherwise produce `Infinity` and silently poison every downstream coordinate. Tested against 0, negative, and NaN.

### §12 — adaptive snapshot rate

`Cadence` in `input.rs`: 15 Hz active, 5 Hz calm, 1 Hz resting, and **no snapshots at all while hidden**. The pump recomputes cadence each tick from real idle time.

A subtlety worth naming: `drain_over()` now takes the *actual* elapsed window rather than the old fixed constant. Without that, `cursor_velocity` and the frontend's keys-per-second conversion both come out wrong by up to 15× the moment the cadence steps down — a bug that would only have shown up as "the dog acts weird after you leave it alone for a minute". `Activity` also carries `batch_ms` now so the frontend converts against the real window.

---

## Phase 2 — behaviour engine

`src/pet/engine.ts`. Replaces the flat if-chain, which had no timing, hysteresis or cooldowns.

**Full §13.1 behaviour record.** Every state carries: priority, entry/loop/exit animation, mode, minMs, maxMs, cooldownMs, interruptibility, sound, reduced-motion alternative, and fallback. 16 states across the §13.2 priority ladder.

**Detectors for the timing-based triggers.** `SustainedDetector` implements the plan's "1200 px/s *sustained for 200 ms*" — without it the dog lunges at every stray flick of the mouse. `ReversalDetector` handles both petting (3 strokes in 1.5 s) and shaking (3 reversals in 800 ms) with a minimum-delta filter so cursor jitter doesn't register as stroking.

**Deterministic and clock-free.** `update(now, signals)` takes time as an argument, so the whole engine can be driven frame-by-frame in tests. That's what makes the 5,000-update fuzz test possible.

### Two real bugs found and fixed during the phase

**A state could get stuck forever.** `pick()` returned the current state as soon as it appeared in priority order, without re-checking whether its trigger was still true. Once the dog entered a behaviour it stayed there indefinitely unless something *higher* priority fired. The scroll reaction would have latched on and never released.

**The dog could never sleep.** `idle` shares priority 12 with `sleepy` and `asleep`, and sat first in the table — its always-true predicate shadowed both. Sleep is the single most visible behaviour in the product and it was unreachable. Rest states now sort above `idle`, `asleep` above `sleepy`, and the file carries an ORDER MATTERS warning so nobody re-sorts it innocently.

Both have named regression tests, and I verified those tests actually catch the bugs by reintroducing each one and confirming the suite goes red.

### Safety properties now proven, not assumed

- **Never wedges** — 5,000 pseudo-random updates with adversarial signal combinations; every result is a valid state with a renderable frame.
- **Always returns to idle** when triggers go quiet.
- **`maxMs` forces an exit** even with a trigger stuck permanently on.
- **Cooldowns block re-entry** but never block *staying* in the current state.
- **Missing artwork degrades to idle** rather than crashing — tested with a one-frame atlas and with an empty one.
- **Reduced motion** substitutes the calm alternative.
- **Sounds fire once per entry**, not once per frame.
- **Table integrity**: no self-referential fallbacks, every non-interruptible state has a `maxMs`, every `maxMs` exceeds its `minMs`.

---

## Honest gaps

**Nothing has been run.** 77 green tests prove the logic; they prove nothing about whether Tauri opens a transparent window, whether click-through works on macOS, or what the CPU actually is. Every Phase 1 exit criterion is still a measurement I cannot take.

**The Rust is still unverified.** No toolchain here — rustup is blocked by the sandbox network policy. The `Cadence` code is written from the API surface, not from a successful `cargo check`.

**`main.ts` is now wired to the engine.** It builds `Signals` from each Rust snapshot, runs the three detectors, and renders whatever the engine returns. `behaviour.decide()` is no longer called from the renderer — it stays as the reference implementation its own tests cover.

Two details worth knowing when you read it:

- **Petting only accumulates while the cursor is over the head region and on a solid pixel.** The reversal detector is reset the moment the cursor leaves, so waving the mouse around near the dog can't fake a stroke.
- **`syncWindowGeometry()` re-reads scale factor after every drag**, because a drag can cross onto a monitor with a different DPI. Without that, every subsequent hit test would be computed against the old scale.

**Three states are stubs.** `stretch`, `wander` and `recover` have `when: () => false`. They need the reminder scheduler and idle-timer plumbing, which is Phase 4.

**The placeholder atlas doesn't have the frames the engine wants** — `drag`, `land`, `lie_down`, `bark`, `deliver_note`, `tail_wag`, `sit_happy`, `walk_b`. The engine degrades to `idle` for those, which is exactly the designed behaviour, but the dog will look repetitive until real art lands in Phase 3.

---

## Decisions I took rather than leaving open

**§9.3's 224 px: treated as a typo, built as 192.** 96 × 2 = 192, and the plan gives no padding rationale, so 192 is what follows from its own numbers. `tauri.conf.json` and a coords test both assert 192. If 224 was deliberate — say 16 px of bleed on each side for effects that overflow the sprite — then the *cell* should be 112, not the window, and that changes the artist brief. One line from you flips it; leaving it ambiguous while the artist works would be worse.

---

## Still blocked on you

1. **Run the spike.** `RUNNING.md` has the commands. Phase 1 cannot close without the numbers.
2. **Confirm the 96 px cell** so the artist brief can go out.
3. **Drag `PAWI_MASTER_PROGRAM_PLAN.md` into `docs/`.**
