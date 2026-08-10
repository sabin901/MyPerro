# Commission Brief — Pixel Art Dog Sprite Set

**Project:** MyPerro — an open-source desktop companion app (macOS, Windows, Linux)
**Client:** Sabin Raut
**Date:** 8 August 2026
**Send this document as-is when requesting quotes. Attach the five reference images from `art/reference/`.**

---

## 1. What this is

MyPerro is a small pixel-art dog that lives on the user's desktop. It sits above other windows, watches the mouse cursor, reacts when the user types, sleeps when they walk away, and reminds them to stretch and drink water. It is free and open source.

The dog is the entire product. The code is invisible; the animation is what people will fall in love with or ignore. I'm commissioning this rather than drawing it myself because the quality of the character work decides whether this succeeds.

**The feeling I'm after:** warm, calm, a little bit silly. Not hyperactive, not corporate-mascot, not "kawaii" as a costume. The dog should feel like it has an inner life and is mildly amused by you. Think of a pet that's happy you're home but too dignified to make a scene about it.

**About the attached reference images.** Five AI-generated concept sheets are attached. They are **tone, proportion and palette reference only — please do not trace them, downscale them, or use them as source material.** They exist because it's easier to show you the target feel than describe it. Details worth carrying across: the chunky proportions, oversized head, small dark eyes, and the red collar with a gold bell as a signature element.

**Reference for quality bar, not style:** Comnyang (comnyang.com). Please do not imitate its cat, palette, animations or poses — this must be entirely original, and I'll be checking for distinctiveness.

---

## 2. The character

**Breed:** Shiba Inu
**Build:** compact, slightly chunky, short legs. Rounder than a real Shiba — read as "young dog", not accurate breed reference.
**Signature shapes:** triangular upright ears, tightly curled tail, squarish muzzle, small dark eyes, red collar with gold bell.
**Personality in the pose work:** smug, self-possessed, secretly very fond of the user. It should look like it's judging you slightly, even when happy.

The three shapes that must stay readable in every frame are **the ear triangles, the tail curl and the muzzle**. If a pose loses those, the dog stops being recognisable.

---

## 3. Technical specification

Hard requirements — the rendering code is built around them.

| Spec | Value |
|---|---|
| Canvas per frame | 64 × 64 px |
| Character occupies | ~40–52 px wide, ~34–46 px tall |
| Palette | Maximum 16 colours, indexed |
| Outline | 1 px, dark, may be selectively coloured |
| Anti-aliasing | **None.** Hard pixel edges only |
| Background | Fully transparent — no green screen, no matte |
| Sub-pixel positions | Not permitted |
| Ground line | Consistent baseline across all grounded frames |
| Pivot | Bottom-centre, identical across all frames |
| Facing | Right-facing only; the app mirrors for left. Keep asymmetric details centred — see `ART_GUIDE.md` §2 |

**Palette rules.** The app recolours the dog at runtime so users can match their own dog's markings, which requires structured indices:

- 0–5: body fur ramp (dark shadow → highlight)
- 6–8: marking / secondary fur ramp
- 9–10: eyes
- 11–12: nose, mouth, paw pads
- 13–14: collar
- 15: outline

Supply the palette as a `.gpl` or `.hex` file. Every pixel snapped to these indices, no off-palette blending.

**Layer separation.** Each frame delivered with these as separate Aseprite layers, not flattened:

```
body        — base fur, no markings
markings    — the recolourable pattern layer
ears        — animate independently
tail        — animates independently
eyes        — track the cursor independently
accessory   — collar (empty layer fine where hidden)
overlay     — steam, hearts, sweat, sleep Z's
```

Eyes and ears on their own layers is essential — the app moves them programmatically to follow the mouse, so they cannot be baked into the body. This is the single most important technical requirement in the brief.

---

## 4. Animation list

**32 animations, 148 frames**, plus overlays and props below. Frame counts are guidance — use fewer if a pose reads better, more if needed, but flag significant changes.

### Core idle and rest (7 animations, 32 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 1 | `idle` | 4 | 6 | Yes | Sitting, breathing. Most-seen animation in the app — give it the most care |
| 2 | `blink` | 3 | 10 | No | Overlays idle |
| 3 | `sit` | 4 | 8 | No | Standing → sitting |
| 4 | `lie_down` | 6 | 8 | No | Sitting → lying |
| 5 | `sleep` | 4 | 3 | Yes | Curled, tail over nose, slow breathing |
| 6 | `wake` | 6 | 8 | No | Eyes open, small startle, sits up |
| 7 | `yawn` | 5 | 8 | No | Wide yawn, tongue curl |

### Movement (5 animations, 24 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 8 | `walk` | 6 | 10 | Yes | Relaxed trot, tail curl bounces slightly |
| 9 | `run` | 6 | 16 | Yes | Full gallop, ears back |
| 10 | `turn` | 4 | 12 | No | Reversing direction |
| 11 | `stand` | 2 | 6 | Yes | Still, subtle breathing |
| 12 | `jump` | 6 | 12 | No | Happy hop, squash on landing |

### Cursor and attention (4 animations, 16 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 13 | `alert` | 3 | 10 | No | Ears snap up, head lifts |
| 14 | `head_tilt` | 4 | 8 | No | The classic confused tilt. A signature moment |
| 15 | `chase` | 6 | 16 | Yes | Pouncing at the cursor, front paws forward |
| 16 | `look_up` | 3 | 8 | No | Tracking something above |

### Typing reactions (3 animations, 12 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 17 | `type_paw` | 4 | 12 | Yes | Patting a tiny keyboard. Keyboard drawn into this animation |
| 18 | `type_intense` | 4 | 18 | Yes | Faster, frantic, ears flattened |
| 19 | `pant` | 4 | 10 | Yes | Tongue out, chest heaving, sweat drop |

### Interaction (5 animations, 20 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 20 | `pet_happy` | 5 | 10 | Yes | Eyes squeezed shut, leaning in, tail blur |
| 21 | `tail_wag` | 4 | 14 | Yes | Tail only — other layers static, overlays any pose |
| 22 | `drag` | 3 | 8 | Yes | Held up, legs dangling, mildly affronted |
| 23 | `shake` | 4 | 16 | Yes | Wobbling after being shaken |
| 24 | `land` | 4 | 12 | No | Dropped, dust puff, shakes it off |

### Reminders and utility (5 animations, 28 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 25 | `stretch` | 8 | 8 | No | Downward-dog. Front low, rear high, long hold. Hero animation |
| 26 | `drink` | 6 | 8 | Yes | Lapping from a bowl. Bowl included |
| 27 | `focus_sit` | 4 | 4 | Yes | Sitting patiently, very still — plays during Pomodoro |
| 28 | `deliver_note` | 6 | 10 | No | Trots in with an envelope, sets it down |
| 29 | `bark` | 4 | 12 | No | Two sharp barks, small speech puff |

### Personality extras (3 animations, 16 frames)

| # | Name | Frames | FPS | Loop | Notes |
|---|---|---|---|---|---|
| 30 | `side_eye` | 4 | 6 | No | Slow head turn, flat judgemental stare, holds. Character-defining |
| 31 | `scratch` | 6 | 12 | Yes | Rear leg scratching behind the ear |
| 32 | `zoomies` | 6 | 20 | Yes | Manic sprint with motion lines |

### Effect overlays (separate sheet, 21 frames)

Sleep Z's (3), hearts (4), steam puff (4), sweat drop (3), dust puff (3), sparkle (4). 32 × 32 canvas, same palette rules.

### Props and interface pieces (static)

| Item | Size | Notes |
|---|---|---|
| Speech / note bubble | 9-slice, ~48 × 32 base | Must tile cleanly for variable text width. Tail pointing down at the dog |
| Pixel digits `0–9` and `:` | 5 × 7 each | Pomodoro clock readout |
| Pomodoro clock frame | ~40 × 24 | Houses the digits |
| Water bowl | 16 × 12 | Standalone, for reminder popups |
| Ball toy | 10 × 10 | Two colour variants |
| Envelope | 12 × 10 | Matches `deliver_note` |
| App icon | 512² plus 256/128/64/32/16 | Dog's face, readable at 16 px — genuinely hard, please budget for it |
| Tray / menu-bar icon | 22² and 44² | Monochrome silhouette, macOS template rules: pure black on transparent |

The tray icon and 16 px app icon are small but disproportionately difficult. Price them deliberately rather than as throw-ins.

---

## 5. Deliverables

1. **Source files** — layered `.aseprite`, with animation tags using the exact names above.
2. **Exported sprite sheet** — single packed PNG atlas plus Aseprite JSON metadata.
3. **Palette file** — `.gpl` or `.hex`, structured per section 3.
4. **Per-animation preview GIFs** for review.
5. **A character sheet PNG** with 6–8 key poses, for the README and store pages.

Aseprite is required — the export pipeline is built around its JSON format. If you use another tool, tell me before quoting.

---

## 6. Process, budget and timeline

| Stage | What happens | Payment |
|---|---|---|
| 1. Character design | 3 style/proportion options as static poses. I pick one | 25% |
| 2. Core set | Animations 1–19 delivered and reviewed | 40% |
| 3. Full set | Animations 20–32, overlays, props | 25% |
| 4. Final | Revisions applied, source files handed over | 10% |

**Revisions:** two rounds per milestone, reasonable scope — I won't ask for a character redesign at stage 3.

**Budget:** expecting quotes in the **$300–800 USD** range for the full set. Tell me what you'd charge and what you'd cut to fit a budget — I'd rather have 20 excellent animations than 32 rushed ones.

**Timeline:** ideally stage 1 within a week of starting, full delivery in four to five weeks. A realistic date is worth more to me than an optimistic one.

---

## 7. Rights and credit

Read carefully before quoting — this is unusual and affects your price.

- **Work-for-hire.** I need full commercial rights to use, modify and distribute.
- **The app is open source and the art ships under CC BY 4.0.** Anyone may use and modify it, including commercially, with credit to you. If that's not acceptable, say so at quoting stage — I can discuss a more restrictive art licence, though it complicates the project.
- **Prominent credit:** by name in the app's About screen, the repository README, `ATTRIBUTIONS.md`, and all launch materials, with a link to your portfolio or shop.
- **You keep portfolio rights**, including source files and process material.
- **You must warrant the work is original** and contains no third-party assets, **no AI-generated material**, and no traced references from other games or apps. This matters a great deal — the attached reference images are AI-generated concepts, and the delivered artwork must be entirely your own human work. The project's premise is being an original alternative to an existing app, and derivative or AI-sourced artwork would sink it.

---

## 8. What "good" looks like

Two things I'll judge most heavily:

1. **The idle animation.** Users see it for hours. Alive without being distracting — breathing, occasional ear flicks, weight shifts. Most desktop pets fail here by being either statue-still or twitchy.
2. **The side-eye and the head tilt.** These give the dog a personality rather than a behaviour. If someone screen-records this app and posts it, it'll be because of one of these.

Everything else can be competent. Those need to be excellent.

---

## 9. Questions to answer in your quote

1. Price for the full set, and for a reduced set if you'd recommend one.
2. Realistic dates for stage 1 and final delivery.
3. Whether CC BY 4.0 works for you.
4. Whether you work in Aseprite.
5. Two or three examples of prior animated pixel-art character work, ideally animals.

Thank you — I'd rather work with someone excited about the character than someone filling an order, so if the Shiba concept sparks ideas, tell me.
