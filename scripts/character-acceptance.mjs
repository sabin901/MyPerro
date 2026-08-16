#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const artRoot = join(root, "art", "exported");
const requiredPairs = [
  ["tail_wag", "tail_wag_alt"], ["walk_a", "walk_b"], ["run", "run_alt"],
  ["type_paw", "type_paw_alt"], ["drink", "drink_alt"], ["eat", "eat_alt"],
  ["pet_happy", "pet_happy_alt"], ["sleep", "sleep_alt"], ["paper_unroll", "paper_unroll_alt"],
];
const expectedFrames = 49;
const rows = [];
let failed = false;

function pixels(png, frame) {
  const bytes = Buffer.alloc(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y++) {
    const start = ((frame.y + y) * png.width + frame.x) * 4;
    png.data.copy(bytes, y * frame.w * 4, start, start + frame.w * 4);
  }
  return bytes;
}

function difference(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) changed++;
  }
  return changed / (a.length / 4);
}

for (const dirent of readdirSync(artRoot, { withFileTypes: true }).filter(item => item.isDirectory())) {
  const dir = join(artRoot, dirent.name);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const png = PNG.sync.read(readFileSync(join(dir, "atlas.png")));
  const names = Object.keys(manifest.frames);
  const hashes = names.map(name => createHash("sha256").update(pixels(png, manifest.frames[name])).digest("hex"));
  const pairDiffs = requiredPairs.map(([a, b]) => difference(pixels(png, manifest.frames[a]), pixels(png, manifest.frames[b])));
  const minPairDiff = Math.min(...pairDiffs);
  const directionsOk = ["walk", "walk_a", "walk_b", "run", "run_alt", "chase"]
    .every(name => manifest.frameFacing?.[name] === "left") && manifest.frameFacing?.turn === "right";
  const pass = names.length === expectedFrames && new Set(hashes).size / names.length >= .6 && minPairDiff >= .001 && directionsOk;
  failed ||= !pass;
  rows.push({ id: dirent.name, frames: names.length, unique: new Set(hashes).size / names.length, minPairDiff, directionsOk, pass });
}

const report = [
  "# Character acceptance report",
  "",
  "Generated from the shipped atlases. Every companion must expose the complete semantic motion set, distinct alternate cels, and explicit native movement direction.",
  "",
  "| Companion | Frames | Unique cels | Smallest alternate difference | Facing metadata | Result |",
  "|---|---:|---:|---:|---|---|",
  ...rows.map(row => `| ${row.id} | ${row.frames} | ${(row.unique * 100).toFixed(0)}% | ${(row.minPairDiff * 100).toFixed(2)}% | ${row.directionsOk ? "pass" : "fail"} | ${row.pass ? "pass" : "fail"} |`),
  "",
  "Automated acceptance cannot judge emotional appeal or sound character. Those remain explicit human checks in `release/qa/README.md`.",
  "",
].join("\n");
writeFileSync(join(root, "art", "CHARACTER_ACCEPTANCE.md"), report);
for (const row of rows) console.log(`${row.pass ? "✓" : "✗"} ${row.id}: ${row.frames} frames, ${(row.unique * 100).toFixed(0)}% unique, min pair delta ${(row.minPairDiff * 100).toFixed(2)}%`);
if (rows.length !== 9 || failed) process.exit(1);
