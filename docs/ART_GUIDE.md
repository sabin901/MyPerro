# Pawi — Master Art Guide

The binding rules every dog must follow. The artist works from `ARTIST_BRIEF.md`; this file is what a submitted sprite gets *checked against*, and what the asset validator will enforce in Phase 3.

**Where this sits in the plan:** this is the art track, which runs in parallel with the code phases (commissioned during Phase 0, integrated in Phase 3). It is not a gate on the Phase 1 technical spike — the spike renders a placeholder deliberately, so that window behaviour and CPU can be measured before a single final pixel exists.

---

## 1. Canvas and scaling

| Rule | Value |
|---|---|
| Logical canvas | 64 × 64 px |
| Character height | 34–46 px, consistent across all poses of a breed |
| Character width | 40–52 px |
| Display sizes | **64, 128, 192, 256** — integer multiples only |
| Scaling filter | Nearest-neighbour, always |
| Anchor | Bottom-centre, between the front paws |
| Outline | 1 px, one dark colour per breed |
| Palette | 12–18 colours per breed, indexed |
| Export | Transparent PNG, hard alpha, no semi-transparent edge pixels |

**A correction worth making explicit:** a 96 px display size is 1.5× of 64, which is not an integer multiple. At 1.5× every other source pixel becomes two screen pixels and the rest become one, so the outline thickness visibly alternates and the sprite looks wobbly. If a 96-ish size is needed on a particular display, render at 128 and letterbox rather than scaling to 96.

## 2. Facing direction

**Masters are drawn right-facing.** The app mirrors horizontally for left.

This must be decided once and never revisited, because it determines which side asymmetric details live on. Anything that isn't symmetrical — a collar buckle, a marking patch, an ear notch — will flip when mirrored, so either keep those details symmetrical or accept that they swap sides. The collar tag must sit dead centre on the chest for exactly this reason.

## 3. Shared identity across breeds

Every dog in Pawi must read as the same family. Locked elements:

- **Red collar with a round gold tag**, centred, identical geometry on all breeds
- Same eye rendering style — small, dark, high-contrast, with a single highlight pixel
- Same outline weight and darkness logic
- Same head-to-body ratio bracket (head roughly 40–45% of total height)
- Same ground contact — all four paws on the same baseline in grounded poses
- Same emotional vocabulary — a happy Shiba and a happy Husky use the same eye and mouth shapes

Breed differences come from silhouette, coat and markings. They must never come from a different art style.

## 4. Per-pose consistency

The single biggest problem with the current concept sheets, and the thing a pixel artist is being hired to fix:

- Character height identical in every grounded pose
- Markings in the same anatomical place in every pose
- Tail shape and curl identical, allowing for motion
- Collar and tag identical in size, position and colour
- Ear shape identical
- Eye size and spacing identical
- No stray or orphaned pixels outside the silhouette
- No colour outside the locked palette

A useful test: flip between any two poses of the same breed at 4× zoom. Nothing should "pop" or change size except the parts that are meant to be moving.

## 5. Poses vs animations — the distinction that matters

The concept sheets contain **20 poses**. The brief commissions **32 animations, 148 frames**. These are not in conflict, and the difference is the whole job:

> A pose is one drawing. An animation is 4–6 drawings that differ by a few pixels each.

A single "walk" pose becomes a 6-frame walk cycle. A single "sleep" pose becomes a 4-frame breathing loop. The 20 poses are the *vocabulary*; the 148 frames are what makes them move. Any quote that prices 20 drawings is pricing the concept sheet again, not the deliverable.

## 6. Pose vocabulary

**Approved from the concept sheets (20):** idle, blink, look left, look right, happy sit, sleep, stretch, walk, trot, run, tail wag, pet reaction, calm typing, excited typing, play bow, sneeze, alert/curious, relaxed, celebration, breed-exclusive.

**Added in the brief, and needed for the PRD's promised features (12):** sit, lie down, wake, yawn, turn, stand, jump, head tilt, chase, pant, drink, deliver note, bark, scratch, side-eye, zoomies.

Of these additions, three are non-negotiable because a v1 feature breaks without them:

- **`drink`** — the water reminder has no animation otherwise
- **`stretch`** as a full 8-frame downward-dog — the stretch reminder is a headline feature
- **`deliver_note`** — the pinned note has no delivery moment

**Deliberately not commissioned for v1:** eating, digging, carrying a toy, sad, waiting, notification reaction. All are good ideas; none support a v1 feature, and each one is real money. They go in the post-1.0 pack.

## 7. Breed order

Confirmed, and it matches the launch-viability ranking in `breed-options.md`:

1. **Shiba Inu** — launch breed, full 32-animation set
2. **Pomeranian** — second
3. **Husky** — third
4. German Shepherd, Dalmatian, Lhasa Apso — post-launch or community packs

Only breed 1 is commissioned now. Breeds 2 and 3 are commissioned after the Shiba is delivered, integrated and proven in the app — because the first breed will expose problems in this guide that are cheaper to fix once than three times.

## 8. File naming

```
art/source/<breed>/<breed>_<animation>.aseprite
art/exported/<breed>/atlas.png
art/exported/<breed>/atlas.json
art/exported/<breed>/palette.gpl
art/reference/<breed>_concept.png
```

Breed IDs are lowercase, hyphenated, stable forever: `shiba-inu`, `pomeranian`, `husky`, `german-shepherd`, `dalmatian`, `lhasa-apso`. They appear in save files, so renaming one later breaks users' settings.

## 9. Originality

Every delivered sprite must be original human work. No AI generation, no tracing, no third-party assets. The concept sheets in `art/reference/` are AI-generated and exist purely to communicate intent — they are explicitly not source material, and the delivered art must be visually distinct from them as well as from any existing desktop-pet product.

The Dalmatian, when it eventually gets made, needs deliberate visual distance from a very famous and very heavily defended animated property.

## 10. Acceptance checklist

A breed is done when:

- [ ] Front and side master sprites approved
- [ ] Palette locked and exported as `.gpl`
- [ ] All 32 animations delivered with correct tag names
- [ ] Height consistent across all grounded poses
- [ ] Markings consistent across all poses
- [ ] Collar and tag identical everywhere
- [ ] No off-palette or semi-transparent pixels
- [ ] Layers separated: body, markings, ears, tail, eyes, accessory, overlay
- [ ] Mirrors cleanly with no asymmetry artefacts
- [ ] Passes the Phase 3 asset validator
- [ ] Reads clearly at 64 px on a busy desktop background
