"""Build a frame-safe production atlas from a 4x4 premium concept sheet.

The source sheets are approved character art, but image generation left thin
grid pixels on some tile boundaries. Every source cell is inset, normalized
onto a transparent safe area, then given a state-specific motion treatment.
The runtime therefore gets one addressable cel per behavior without sacrificing
the character identity and rendering quality of the premium source.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

CELL = 192
COLS = 8
POSES = {
    "idle": 0, "sit": 0, "sit_side": 0, "stand": 0, "side_eye": 0, "head_tilt": 0, "look_up": 0,
    "blink": 1, "tail_wag": 2, "tail_wag_alt": 0, "walk": 3, "walk_a": 3,
    "walk_b": 4, "run": 4, "run_alt": 3, "chase": 4, "turn": 4, "drag": 4,
    "type_paw": 5, "type_paw_alt": 6, "type_intense": 6, "type_intense_alt": 5,
    "focus_sit": 6, "drink": 7, "drink_alt": 7, "eat": 8, "eat_alt": 8,
    "beg": 9, "play": 10, "zoomies": 10, "pet_happy": 11, "pet_happy_alt": 2,
    "sleep": 12, "sleep_alt": 12, "lie_down": 12, "wake": 13, "stretch": 13,
    "yawn": 13, "alert": 14, "bark": 14, "scratch": 14, "jump": 15,
    "happy_jump": 15, "shake": 15, "land": 15, "pant": 2,
    "deliver_note": 6, "paper_unroll": 6, "paper_unroll_alt": 6,
}

MOTION = {
    "idle": (0, 0, 1.00, 0), "sit": (0, 1, .99, 0), "stand": (0, -1, 1.01, 0),
    "side_eye": (2, 0, 1.00, 0), "head_tilt": (-1, 0, .98, -4), "look_up": (0, -3, .99, 0),
    "tail_wag_alt": (1, 0, 1.01, 2), "walk_a": (-2, 0, 1.00, -1),
    "walk_b": (2, 0, 1.00, 1), "run": (2, -1, 1.02, 1), "run_alt": (-2, 0, 1.01, -1),
    "chase": (3, -1, 1.03, 1), "turn": (-2, 0, .99, -1), "drag": (0, -3, .96, -3),
    "type_paw_alt": (1, 0, 1.00, 0), "type_intense": (0, -1, 1.01, 0),
    "type_intense_alt": (-1, 0, 1.01, 0), "focus_sit": (0, 1, .99, 0),
    "drink_alt": (0, 1, 1.01, 0), "eat_alt": (1, 1, 1.01, 0),
    "play": (0, -2, 1.02, -1), "zoomies": (2, -2, 1.03, 1),
    "pet_happy_alt": (0, -1, 1.02, 1), "sleep_alt": (1, 1, 1.01, 0),
    "lie_down": (-1, 1, .99, 0), "wake": (0, -2, 1.01, -1),
    "stretch": (1, 0, 1.02, 1), "yawn": (0, -1, 1.01, 0),
    "bark": (0, -2, 1.02, -1), "scratch": (-1, 0, 1.01, -2),
    "jump": (0, -5, .98, 0), "happy_jump": (0, -7, 1.00, 0),
    "shake": (0, -1, 1.02, 3), "land": (0, 2, 1.03, 0),
    "pant": (0, 1, 1.01, 0), "deliver_note": (0, 0, .99, 0),
    "paper_unroll": (-1, 1, 1.00, 0), "paper_unroll_alt": (1, 1, 1.00, 0),
}


def safe_source_cells(source: Image.Image) -> list[Image.Image]:
    cells: list[Image.Image] = []
    for row in range(4):
        for col in range(4):
            left = round(source.width * col / 4)
            top = round(source.height * row / 4)
            right = round(source.width * (col + 1) / 4)
            bottom = round(source.height * (row + 1) / 4)
            # Generated sheets sometimes contain a 1px white/opaque separator.
            # Inset proportionally, then reserve a transparent runtime gutter.
            inset = max(2, round(min(right - left, bottom - top) * .006))
            crop = source.crop((left + inset, top + inset, right - inset, bottom - inset))
            # A 10px per-side gutter survives the strongest 1.03 squash/
            # stretch variant and prevents tails, whiskers and ears bleeding
            # into a neighboring frame during GPU texture sampling.
            crop.thumbnail((CELL - 20, CELL - 20), Image.Resampling.LANCZOS)
            clean = Image.new("RGBA", (CELL, CELL))
            clean.alpha_composite(crop, ((CELL - crop.width) // 2, (CELL - crop.height) // 2))
            cells.append(clean)
    return cells


def motion_variant(source: Image.Image, name: str) -> Image.Image:
    dx, dy, scale, angle = MOTION.get(name, (0, 0, 1.0, 0))
    width = max(1, round(CELL * scale))
    height = max(1, round(CELL * scale))
    variant = source.resize((width, height), Image.Resampling.LANCZOS)
    if angle:
        variant = variant.rotate(angle, Image.Resampling.BICUBIC, expand=False)
    cell = Image.new("RGBA", (CELL, CELL))
    cell.alpha_composite(variant, ((CELL - width) // 2 + dx, (CELL - height) // 2 + dy))
    return cell


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-premium-atlas.py INPUT.png OUTPUT_DIR")
    source_path, output_dir = Path(sys.argv[1]), Path(sys.argv[2])
    source = Image.open(source_path).convert("RGBA")
    source_cells = safe_source_cells(source)
    rows = (len(POSES) + COLS - 1) // COLS
    output = Image.new("RGBA", (CELL * COLS, CELL * rows))

    output_dir.mkdir(parents=True, exist_ok=True)
    frames = {}
    source_indices = {}
    for index, (name, source_index) in enumerate(POSES.items()):
        cel = motion_variant(source_cells[source_index], name)
        x, y = index % COLS * CELL, index // COLS * CELL
        output.alpha_composite(cel, (x, y))
        frames[name] = {
            "x": x, "y": y, "w": CELL, "h": CELL, "index": index,
        }
        source_indices[name] = source_index
    output.save(output_dir / "atlas.png", optimize=True)
    meta = {
        "canvas": {"width": CELL, "height": CELL},
        "grid": {"cols": COLS, "rows": rows},
        "displayScale": 1,
        "artStyle": "premium-production-v2",
        "sourceCells": source_indices,
        "landmarks": {"eyes": [{"x": 76, "y": 73}, {"x": 109, "y": 73}]},
        "frames": frames,
    }
    (output_dir / "atlas.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    manifest_path = output_dir / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["canvas"] = meta["canvas"]
        manifest["frames"] = frames
        manifest["artStyle"] = meta["artStyle"]
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
