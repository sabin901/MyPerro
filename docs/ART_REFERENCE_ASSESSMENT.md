# Assessment of the AI Concept Images

**Date:** 8 August 2026
**Subject:** five 1254×1254 PNG sheets — golden retriever, husky, pomeranian, shiba inu, dalmatian
**Verdict: excellent as art direction, unusable as game assets.** Keep them. Send them to the artist. Do not try to ship them.

This isn't a matter of taste. I measured the files, and there are five specific technical reasons they can't drive the app.

---

## What I measured

| File | Size | Unique colours | Alpha | Semi-transparent px |
|---|---|---|---|---|
| Golden retriever | 1254 × 1254 | 171,532 | Yes | 27,094 |
| Husky | 1254 × 1254 | 96,865 | None (green screen) | 0 |
| Pomeranian | 1254 × 1254 | 104,395 | None (green screen) | 0 |
| Shiba inu | 1254 × 1254 | 86,169 | None (green screen) | 0 |
| Dalmatian | 1254 × 1254 | 121,803 | None (green screen) | 0 |

The spec calls for **64 × 64 and a maximum of 16 colours.** These are roughly 20× too large and carry between 5,000 and 10,000 times too many colours.

---

## Problem 1 — this is not actually pixel art

The most important finding. I measured horizontal run-lengths — how many consecutive pixels share an identical colour. In genuine pixel art upscaled to 1254 px from a 64 px source, runs would cluster tightly around 19–20 px, because each "real" pixel becomes a 20 px block.

**Measured mean run length: 1.07 pixels.** 77,880 runs of length 1, versus 11 runs of length 8.

There is no underlying pixel grid. These are high-resolution paintings *in the style of* pixel art — soft gradients, blended shading, hand-varied edges. Downscaling them to 64 × 64 won't recover a sprite, it will produce mush, because there's no grid to snap back to.

## Problem 2 — green screen instead of transparency

Four of the five use a flat green background. Chroma-keying leaves green fringing on every anti-aliased edge, and these already show visible green halos — the golden retriever sheet has green contamination even on its supposedly transparent version. On a desktop pet, where the sprite sits directly on top of whatever the user is doing, edge fringing is immediately obvious and looks broken.

## Problem 3 — anti-aliased edges

The one file with real alpha has 27,094 semi-transparent pixels. The spec is hard edges, no anti-aliasing, because the app scales at integer multiples (2×, 3×, 4×). Anti-aliased pixels multiplied by 3 become blurry 3 px smears.

## Problem 4 — these are illustrations, not animation frames

This is the deepest issue and no amount of cleanup fixes it.

Each pose is a separate drawing. The sitting golden retriever and the walking golden retriever are different sizes, drawn at different scales, with different proportions and different levels of detail. There is no consistent baseline, no consistent pivot, no shared skeleton.

Animation needs *frames*, not poses — four to six near-identical drawings per action that differ by a few pixels. These sheets have roughly one pose per action and no in-betweens. You cannot interpolate them, because AI generation doesn't hold a character stable enough between images.

## Problem 5 — everything is flattened

The brief requires ears, tail and eyes on separate layers, because the app moves them programmatically to track the cursor. That's the feature the whole product is built around. In these images all of it is baked into a single flat layer, so the eye-follow and ear-tracking mechanics simply cannot be implemented on top of them.

---

## Two risks worth naming

**Licensing.** The artist brief asks for a warranty that the work is original and free of AI-generated material, and the art ships under CC BY 4.0. If AI-generated images were used as assets, that warranty can't be given, and the copyright status of the artwork becomes unclear in several jurisdictions. As *reference material handed to a human artist*, this is a non-issue — mood boards are normal practice. As shipped assets it's a real problem.

**The dalmatian specifically.** A spotted white puppy with black ears and a red collar sits uncomfortably close to a very famous and very heavily defended Disney property. If a dalmatian is ever made, it needs deliberate visual distance. This reinforces putting it last in the breed order.

---

## What these are genuinely good for

They're a strong art direction document, and they answer a question that was open yesterday: **what should this dog feel like?**

The chunky proportions, the oversized head, the small dark eyes, the red collar with a gold bell, the warm palette — that's a coherent and appealing direction, and it's much easier to hand an artist five images than three paragraphs of adjectives.

Concretely, use them to:

1. **Attach to the artist brief** as a "target feel" mood board, clearly labelled as reference, not as assets to trace.
2. **Settle the character design questions** the brief left open — proportion, head-to-body ratio, collar as a signature element.
3. **Serve as programmer-art placeholders during Phases 1 and 2.** Crop one pose, downscale it, accept that it looks rough. The code only needs *something* rectangular to move around while the window and behaviour systems get built.
4. **Sanity-check breed silhouettes.** The pomeranian and shiba read clearly. The dalmatian's spots already look noisy even at 1254 px, which confirms the concern about spots at 64 px.

---

## Changes to make to the artist brief

1. Attach these five images, labelled **"tone and proportion reference — do not trace, do not use as source material."**
2. Add: the collar with a gold bell is a signature element and should carry across all breeds.
3. Add explicitly: **no AI-generated material may be incorporated**, given the reference images themselves are AI-generated and the distinction matters legally.
4. Confirm the Shiba is the launch breed — reference sheet four is the closest to the intended feel.
