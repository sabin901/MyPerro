# Dog-pack format

A dog pack adds a new breed to MyPerro without touching the app's code. It's a
folder anyone can make, share, and drop in.

## Folder layout

```
my-breed/
  manifest.json      # required — describes the pack
  atlas.png          # required — the sprite sheet, transparent PNG
  preview.gif        # optional — for the gallery
  LICENSE            # required — how others may use your art
```

## manifest.json

```json
{
  "schemaVersion": 1,
  "id": "golden-retriever",
  "name": "Golden Retriever",
  "author": "Your Name",
  "license": "CC-BY-4.0",
  "canvas": { "width": 96, "height": 96 },
  "frames": {
    "idle":      { "x": 0,   "y": 0, "w": 96, "h": 96 },
    "sleep":     { "x": 96,  "y": 0, "w": 96, "h": 96 },
    "walk_a":    { "x": 192, "y": 0, "w": 96, "h": 96 },
    "sit_side":  { "x": 288, "y": 0, "w": 96, "h": 96 },
    "type_paw":  { "x": 384, "y": 0, "w": 96, "h": 96 },
    "pet_happy": { "x": 0,   "y": 96, "w": 96, "h": 96 },
    "drag":      { "x": 96,  "y": 96, "w": 96, "h": 96 }
  }
}
```

## Rules the validator enforces

Run `npm run validate-pack path/to/my-breed` before submitting. It checks:

- `schemaVersion` is 1.
- `id` is a lowercase-hyphen slug (`shiba-inu`, not `Shiba Inu`) — it becomes a
  folder name and a settings key, so it must be safe and stable.
- `name`, `author`, and `license` are all present and non-empty. **Every pack
  must declare a licence.**
- `canvas` width and height are positive integers (square strongly preferred).
- Every frame has integer `x, y, w, h`, and sits fully inside the atlas image.
- All **required animations** are present: `idle`, `sleep`, `walk_a`,
  `sit_side`, `type_paw`, `pet_happy`, `drag`. More is better — the full 32-tag
  set (see `ART_GUIDE.md`) gives the richest behaviour — but these seven are the
  minimum for a working dog.
- The atlas PNG has transparency.

Warnings (not blockers) fire when a frame isn't the declared cell size, or the
canvas isn't square.

## Originality

Packs must be your own original work. No traced art, no AI-generated frames, no
assets lifted from other games or apps. Declare your licence honestly — CC BY 4.0
is recommended and matches the project's own art, but you may choose another as
long as it permits redistribution inside MyPerro.
