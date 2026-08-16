#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = join(root, "dist", "assets");
if (!existsSync(assets)) throw new Error("dist/assets is missing; run npm run build first");
const jsBytes = readdirSync(assets).filter(name => name.endsWith(".js"))
  .reduce((sum, name) => sum + statSync(join(assets, name)).size, 0);
const atlasBytes = readdirSync(join(root, "art", "exported"), { withFileTypes: true })
  .filter(item => item.isDirectory())
  .map(item => statSync(join(root, "art", "exported", item.name, "atlas.png")).size);
const failures = [];
if (jsBytes > 150 * 1024) failures.push(`runtime JavaScript is ${(jsBytes / 1024).toFixed(1)} KiB (budget 150 KiB)`);
if (Math.max(...atlasBytes) > 2 * 1024 * 1024) failures.push(`largest companion atlas is ${(Math.max(...atlasBytes) / 1024 / 1024).toFixed(2)} MiB (budget 2 MiB)`);
if (atlasBytes.reduce((a, b) => a + b, 0) > 15 * 1024 * 1024) failures.push("all companion atlases exceed the 15 MiB budget");
if (failures.length) { failures.forEach(message => console.error(`✗ ${message}`)); process.exit(1); }
console.log(`✓ performance budgets: ${(jsBytes / 1024).toFixed(1)} KiB JS; ${(atlasBytes.reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(2)} MiB atlases`);
