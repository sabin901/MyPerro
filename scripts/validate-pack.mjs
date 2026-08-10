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

// Minimal atlas probe: PNG width/height live at bytes 16–24; alpha (colour
// type 6) at byte 25. Enough to feed the validator without an image library.
let atlas;
const atlasPath = join(dir, "atlas.png");
if (existsSync(atlasPath)) {
  const buf = readFileSync(atlasPath);
  atlas = {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    hasAlpha: buf[25] === 6 || buf[25] === 4, // 6=RGBA, 4=grey+alpha
  };
}

const { validatePack } = await import("../src/pet/pack.ts").catch(async () => {
  // If TS can't be imported directly (no tsx), fall back to a helpful message.
  console.error("Run via: npx tsx scripts/validate-pack.mjs <folder>");
  process.exit(2);
});

const result = validatePack(manifest, atlas);

for (const w of result.warnings) console.warn(`⚠ ${w}`);
if (result.ok) {
  console.log(`✓ ${manifest.id ?? dir} looks good${atlas ? "" : " (manifest only — no atlas.png found)"}`);
  process.exit(0);
} else {
  for (const e of result.errors) console.error(`✗ ${e}`);
  process.exit(1);
}
