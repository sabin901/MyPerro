"""Build a transparent, frame-safe atlas from a 4x4 premium concept sheet.

The approved source art uses a bright green production background. This build
step removes that background deterministically (including soft edge spill),
keeps props only in the actions that need them, reserves a transparent gutter,
and then gives each state a small motion treatment. The runtime therefore never
shows a square backdrop or permanent food/water bowls around an idle companion.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

CELL = 192
COLS = 8
POSES = {
    # The approved 4x4 sheets all use the same semantic order. Keep each
    # runtime state within its real source pose family: the previous pipeline
    # mapped every neutral state to cell 15 (celebration), alternated opposite-
    # facing walk cells, and swapped keyboard/laptop props while typing.
    "idle": 0, "sit": 0, "sit_side": 0, "stand": 0, "side_eye": 0,
    "head_tilt": 0, "look_up": 0, "blink": 1, "tail_wag": 2,
    "tail_wag_alt": 2, "walk": 3, "walk_a": 3,
    "walk_b": 3, "run": 3, "run_alt": 3, "chase": 3, "turn": 4, "drag": 0,
    "type_paw": 5, "type_paw_alt": 5, "type_intense": 5, "type_intense_alt": 5,
    "focus_sit": 6, "drink": 7, "drink_alt": 7, "eat": 8, "eat_alt": 8,
    "beg": 9, "play": 10, "zoomies": 10, "pet_happy": 11, "pet_happy_alt": 11,
    "sleep": 12, "sleep_alt": 12, "lie_down": 12, "wake": 13, "stretch": 13,
    "yawn": 13, "alert": 14, "bark": 14, "scratch": 0, "jump": 15,
    "happy_jump": 15, "shake": 0, "land": 0, "pant": 0,
    "deliver_note": 0, "paper_unroll": 0, "paper_unroll_alt": 0,
}

PROP_FREE_FRAMES = {
    "idle", "sit", "sit_side", "stand", "side_eye", "head_tilt", "look_up",
    "blink", "tail_wag", "tail_wag_alt", "pant", "drag", "scratch", "shake",
    "land", "deliver_note", "paper_unroll", "paper_unroll_alt",
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


def remove_chroma_background(source: Image.Image) -> Image.Image:
    """Turn the generated green screen into real alpha without harming fur."""
    clean = source.convert("RGBA")
    pixels = clean.load()
    for y in range(clean.height):
        for x in range(clean.width):
            red, green, blue, alpha = pixels[x, y]
            dominance = green - max(red, blue)
            if green > 70 and dominance >= 18:
                pixels[x, y] = (red, green, blue, 0)
            elif green > 55 and dominance > 8:
                # Feather anti-aliased green fringe rather than leaving a
                # jagged neon halo around dark fur and whiskers.
                edge_alpha = round(alpha * (18 - dominance) / 10)
                pixels[x, y] = (red, min(green, max(red, blue) + 8), blue, edge_alpha)
    return clean


def keep_largest_component(source: Image.Image) -> Image.Image:
    """Remove detached bowls/sparkles while retaining the complete character.

    Generated shadows can join nearby props with a few translucent pixels, so
    connectivity at alpha > 8 is not enough. Find the largest solid character
    core first, then retain the feathered artwork inside its padded bounds.
    """
    alpha = source.getchannel("A")
    width, height = source.size
    alpha_pixels = alpha.load()
    seen: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            if (x, y) in seen or alpha_pixels[x, y] <= 80:
                continue
            component: list[tuple[int, int]] = []
            queue = [(x, y)]
            seen.add((x, y))
            for qx, qy in queue:
                component.append((qx, qy))
                for nx, ny in ((qx - 1, qy), (qx + 1, qy), (qx, qy - 1), (qx, qy + 1)):
                    if (0 <= nx < width and 0 <= ny < height and
                            (nx, ny) not in seen and alpha_pixels[nx, ny] > 80):
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            components.append(component)
    if not components:
        return source
    keep = max(components, key=len)
    min_x = max(0, min(x for x, _ in keep) - 8)
    max_x = min(width - 1, max(x for x, _ in keep) + 8)
    min_y = max(0, min(y for _, y in keep) - 8)
    max_y = min(height - 1, max(y for _, y in keep) + 8)
    result = source.copy()
    result_pixels = result.load()
    for y in range(height):
        for x in range(width):
            if x < min_x or x > max_x or y < min_y or y > max_y:
                result_pixels[x, y] = (0, 0, 0, 0)
    return result


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
    source = remove_chroma_background(Image.open(source_path).convert("RGBA"))
    # Keep a reviewable transparent sheet beside the original source. This is
    # also useful to artists diagnosing a difficult fur edge.
    if source_path.name == "source.png":
        source.save(source_path.with_name("sheet-transparent.png"), optimize=True)
    source_cells = safe_source_cells(source)
    rows = (len(POSES) + COLS - 1) // COLS
    output = Image.new("RGBA", (CELL * COLS, CELL * rows))

    output_dir.mkdir(parents=True, exist_ok=True)
    frames = {}
    source_indices = {}
    frame_facing = {}
    for index, (name, source_index) in enumerate(POSES.items()):
        source_cell = source_cells[source_index]
        if name in PROP_FREE_FRAMES:
            source_cell = keep_largest_component(source_cell)
        cel = motion_variant(source_cell, name)
        x, y = index % COLS * CELL, index // COLS * CELL
        output.alpha_composite(cel, (x, y))
        frames[name] = {
            "x": x, "y": y, "w": CELL, "h": CELL, "index": index,
        }
        source_indices[name] = source_index
        # The generated sheet's locomotion cel faces left, while the turn cel
        # faces right. Everything else is substantially frontal and must not
        # be mirrored. Persist this instead of relying on an artist convention.
        frame_facing[name] = "left" if source_index == 3 else "right" if source_index == 4 else "front"
    output.save(output_dir / "atlas.png", optimize=True)
    meta = {
        "canvas": {"width": CELL, "height": CELL},
        "grid": {"cols": COLS, "rows": rows},
        "displayScale": 1,
        "artStyle": "premium-production-v3",
        "sourceCells": source_indices,
        "frameFacing": frame_facing,
        "frames": frames,
    }
    (output_dir / "atlas.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    manifest_path = output_dir / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["canvas"] = meta["canvas"]
        manifest["frames"] = frames
        manifest["frameFacing"] = frame_facing
        manifest["artStyle"] = meta["artStyle"]
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
