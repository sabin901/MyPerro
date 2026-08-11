#!/usr/bin/env node
/**
 * CLI wrapper around the pack validator. Reads a pack folder's manifest.json
 * and (if present) checks it against the atlas.png dimensions.
 *
 *   npm run validate-pack path/to/my-breed
 *
 * Kept in plain JS so it runs with no build step. The actual rules live in
 * src/pet/pack.ts and are unit-tested; this file just reads files and prints.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

// Inline the required-animation list and rules by importing the compiled logic
// would need a build; instead we re-run validation through a tiny dynamic import
// of the TS via tsx if available, else a JS mirror. To keep this dependency-free
// we shell out to the tests' own validator through a data round-trip.

const dir = process.argv[2];
if (!dir) {
  console.error("usage: npm run validate-pack <pack-folder>");
  process.exit(2);
}

const manifestPath = join(dir, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`✗ no manifest.json in ${dir}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`✗ manifest.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// Premium packs carry the source-cell provenance used to build every runtime
// frame. Validate semantic families as well as PNG structure so a celebration
// pose can never silently become "idle" again.
let atlasMeta;
const atlasMetaPath = join(dir, "atlas.json");
if (existsSync(atlasMetaPath)) {
  try {
    atlasMeta = JSON.parse(readFileSync(atlasMetaPath, "utf8"));
  } catch (e) {
    console.error(`✗ atlas.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
}

const PREMIUM_SOURCE_FAMILIES = [
  [0, ["idle", "sit", "sit_side", "stand", "side_eye", "head_tilt", "look_up", "drag", "scratch", "shake", "land", "pant", "deliver_note", "paper_unroll", "paper_unroll_alt"]],
  [1, ["blink"]],
  [2, ["tail_wag", "tail_wag_alt"]],
  [3, ["walk", "walk_a", "walk_b", "run", "run_alt", "chase"]],
  [4, ["turn"]],
  [5, ["type_paw", "type_paw_alt", "type_intense", "type_intense_alt"]],
  [6, ["focus_sit"]],
  [7, ["drink", "drink_alt"]],
  [8, ["eat", "eat_alt"]],
  [9, ["beg"]],
  [10, ["play", "zoomies"]],
  [11, ["pet_happy", "pet_happy_alt"]],
  [12, ["sleep", "sleep_alt", "lie_down"]],
  [13, ["wake", "stretch", "yawn"]],
  [14, ["alert", "bark"]],
  [15, ["jump", "happy_jump"]],
];

let semanticFailure = false;
if (atlasMeta?.artStyle === "premium-production-v3") {
  for (const [expectedCell, names] of PREMIUM_SOURCE_FAMILIES) {
    for (const name of names) {
      const actual = atlasMeta.sourceCells?.[name];
      if (actual !== expectedCell) {
        console.error(`✗ ${name} uses source cell ${String(actual)}; expected semantic cell ${expectedCell}`);
        semanticFailure = true;
      }
    }
  }
  if (atlasMeta.landmarks?.eyes) {
    console.error("✗ premium packs must not use universal procedural eye landmarks");
    semanticFailure = true;
  }
}

// Minimal atlas probe: PNG width/height live at bytes 16–24; alpha (colour
// type 6) at byte 25. Enough to feed the validator without an image library.
let atlas;
const atlasPath = join(dir, "atlas.png");
if (existsSync(atlasPath)) {
  const buf = readFileSync(atlasPath);
  const png = PNG.sync.read(buf);
  const frames = manifest.frames && typeof manifest.frames === "object"
    ? Object.values(manifest.frames)
    : [];
  let boundaryPixels = 0;
  let opaqueBoundaryPixels = 0;
  const visualHashes = new Set();
  let maxFrameOpaqueRatio = 0;
  for (const frame of frames) {
    if (!frame || !Number.isInteger(frame.x) || !Number.isInteger(frame.y) ||
        !Number.isInteger(frame.w) || !Number.isInteger(frame.h)) continue;
    const hash = createHash("sha256");
    let framePixels = 0;
    let opaqueFramePixels = 0;
    for (let y = 0; y < frame.h; y++) {
      for (let x = 0; x < frame.w; x++) {
        const px = frame.x + x, py = frame.y + y;
        if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
        const offset = (py * png.width + px) * 4;
        framePixels++;
        if (png.data[offset + 3] > 8) opaqueFramePixels++;
        hash.update(png.data.subarray(offset, offset + 4));
        if (x < 2 || y < 2 || x >= frame.w - 2 || y >= frame.h - 2) {
          boundaryPixels++;
          if (png.data[offset + 3] > 8) opaqueBoundaryPixels++;
        }
      }
    }
    if (framePixels > 0) maxFrameOpaqueRatio = Math.max(maxFrameOpaqueRatio, opaqueFramePixels / framePixels);
    visualHashes.add(hash.digest("hex"));
  }
  atlas = {
    width: png.width,
    height: png.height,
    hasAlpha: png.alpha,
    boundaryOpaqueRatio: boundaryPixels === 0 ? 0 : opaqueBoundaryPixels / boundaryPixels,
    uniqueVisualFrameRatio: frames.length === 0 ? 1 : visualHashes.size / frames.length,
    maxFrameOpaqueRatio,
  };
}

const { validatePack } = await import("../src/pet/pack.ts").catch(async () => {
  // If TS can't be imported directly (no tsx), fall back to a helpful message.
  console.error("Run via: npx tsx scripts/validate-pack.mjs <folder>");
  process.exit(2);
});

const result = validatePack(manifest, atlas);

for (const w of result.warnings) console.warn(`⚠ ${w}`);
if (result.ok && !semanticFailure) {
  console.log(`✓ ${manifest.id ?? dir} looks good${atlas ? "" : " (manifest only — no atlas.png found)"}`);
  process.exit(0);
} else {
  for (const e of result.errors) console.error(`✗ ${e}`);
  process.exit(1);
}
