# MyPerro vs ComNyang — honest status

Asked plainly: **how functional is MyPerro compared to the app you showed me?**

Short answer: **as a product, near zero. As an engine, maybe 60% of the behaviour surface.** Those two numbers are both true and the gap between them is the whole story.

---

## The number that matters

ComNyang is a finished $3.90 product that thousands of people have installed and left running all day. MyPerro has **never been launched, not once, by anybody**. Until someone runs `npm start` and sees a dog on their desktop, its real-world functionality is 0% regardless of how much code exists.

Everything below is subject to that.

---

## Feature by feature

| ComNyang | MyPerro | Honest status |
|---|---|---|
| Pixel pet on the desktop | Window + renderer written | **Unverified** — never launched |
| Transparent, always-on-top | Configured in `tauri.conf.json` | **Unverified** — the #1 risk |
| Click-through on empty space | Per-pixel hit testing, unit tested | **Unverified natively.** Logic proven, OS behaviour not |
| Eye follow | Sprite mirrors toward cursor | Partial — whole-body flip, not eyes. Needs layered art |
| Mouse hunt | `chase`, 1200 px/s sustained 200 ms | **Logic done and tested** |
| Keyboard reactions | `typing` / `type_intense` at 2 and 8 keys/sec | **Logic done and tested** |
| Overheat mode | `pant` frame exists, no thermal model | Not built |
| Petting / purring | `pet`, 3 head strokes in 1.5 s | **Logic done and tested.** No sound |
| Mochi drag | Drag implemented, shake detector built | **Unverified** |
| Scroll reaction | `scroll` state | Logic done, threshold untuned |
| Sleep when idle | `sleepy` at 5 min, `asleep` at 10 min | **Logic done and tested** |
| Stretch reminder | State exists, `when: () => false` | **Stub** — needs scheduler (Phase 4) |
| Water reminder | State exists, no scheduler | **Stub** |
| Pomodoro | — | Not started (Phase 4) |
| Scheduled / pinned messages | `reminder` state accepts `note` | **Stub** |
| Fur & pattern customisation | Palette-index scheme designed | Not built (Phase 3) |
| AI agent status | `agent` state + signal | **Engine ready**, no adapters |
| Peek mode | — | Not started |
| Multi-device licensing | — | Not applicable — free and open source |
| Settings window | Placeholder HTML | **Stub** |
| Tray menu | Written, unverified | Unverified |
| Sound | `playSound()` is deliberately empty | Not built |
| Polished original art | AI concept sheets, downscaled placeholder | **Not started** — commission not sent |
| Installers, signing, notarisation | — | Not started (Phase 7) |
| Multiple languages | — | Not started |

---

## Where MyPerro is genuinely ahead

Not many places, but they're real and they're structural:

- **The behaviour engine is more rigorous than it needs to be for v1.** Priorities, cooldowns, min/max durations, interruptibility and forced-exit guarantees, with 77 tests including a 5,000-iteration fuzz proving the dog can't wedge. Most desktop pets are an if-chain.
- **Privacy is architectural, not promised.** Keycodes are discarded in `input.rs` at the point of capture. It's verifiable by reading one file.
- **Adaptive CPU.** 15/5/1/0 Hz snapshots and a per-state frame governor, designed in from the start rather than optimised later.
- **Reduced motion is a first-class concept**, with per-state calm alternatives.
- **Open source**, which ComNyang is not.

## Where it's badly behind

- **The art.** This is the entire product to a user, and MyPerro has a downscaled AI reference sheet with 20 unrelated poses and no animation frames. ComNyang has a professionally animated cat. Nothing else on this list matters as much.
- **Nothing is verified on a real desktop.**
- **No sound, no settings, no reminders, no installer.**

---

## What would actually close the gap, in order

1. **Run the app once.** Everything is theory until then.
2. **Commission the art.** Four to five weeks of calendar time — the true critical path.
3. **Phase 4** for reminders, Pomodoro and settings.
4. **Phase 3** to integrate real animation frames.
5. **Phase 5–7** for cross-platform, packaging and signing.

## In the meantime: `npm run demo`

Because the gap between "engine written" and "engine seen" was doing real damage, there's now a browser demo. It imports the *same* `engine.ts` the app uses, feeds it synthetic input from in-page mouse and keyboard events, and renders the same atlas.

```bash
npm install
npm run demo
```

No Rust, no permissions, no code signing. Move the mouse fast, stroke the dog's head, drag it, type in the box, click "Idle 10m" and watch it sleep. Every state lights up as it fires.

It cannot tell you anything about transparency, click-through, always-on-top or real CPU — those are native, and still need the app. But it does answer *"does this dog feel alive?"*, which is the question that decides whether the project is worth finishing, and it answers it today instead of in three weeks.
