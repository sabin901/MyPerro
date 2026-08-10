#!/usr/bin/env node
/**
 * Static packaged-release smoke test. It catches the exact class of failure
 * where development works but the bundled WebView cannot load companion data.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const config = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const csp = config.app?.security?.csp ?? "";
const failures = [];

if (!/(?:^|;)\s*connect-src[^;]*'self'/.test(csp)) {
  failures.push("CSP connect-src must include 'self' so packaged atlas JSON can load");
}
for (const page of ["index.html", "settings.html"]) {
  if (!existsSync(join(dist, page))) failures.push(`dist/${page} is missing`);
}
const exported = join(dist, "exported");
if (!existsSync(exported)) {
  failures.push("dist/exported is missing");
} else {
  for (const entry of readdirSync(exported, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const folder = join(exported, entry.name);
    const metaPath = join(folder, "atlas.json");
    const imagePath = join(folder, "atlas.png");
    if (!existsSync(metaPath) || !existsSync(imagePath)) {
      failures.push(`${entry.name} is missing atlas.json or atlas.png`);
      continue;
    }
    const atlas = JSON.parse(readFileSync(metaPath, "utf8"));
    if (!atlas.frames?.idle || Object.keys(atlas.frames).length < 40) {
      failures.push(`${entry.name} does not contain a complete runtime animation set`);
    }
  }
}
if (!existsSync(join(dist, "placeholder", "shiba_placeholder.json")) ||
    !existsSync(join(dist, "placeholder", "shiba_placeholder.png"))) {
  failures.push("packaged fallback companion is missing");
}

if (failures.length) {
  failures.forEach(failure => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("✓ packaged pages, CSP, all companion atlases, and fallback assets are present");
