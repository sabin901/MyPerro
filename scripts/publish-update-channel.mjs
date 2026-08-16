#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FALLBACK_RELEASE } from "../website/release-links.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const candidates = [
  `https://github.com/sabin901/Pawi/releases/download/${FALLBACK_RELEASE.tag}/latest.json`,
  "https://github.com/sabin901/Pawi/releases/latest/download/latest.json",
];
let body = "";
for (const url of candidates) {
  const response = await fetch(url, { redirect: "follow" });
  if (response.ok) { body = await response.text(); break; }
}
if (!body) throw new Error("no published signed update manifest is available");
const manifest = JSON.parse(body);
const { validateUpdateManifest } = await import("../src/pet/updateManifest.ts");
const result = validateUpdateManifest(manifest);
if (!result.ok) throw new Error(result.errors.join("; "));
writeFileSync(join(root, "site-dist", "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Published update channel manifest ${manifest.version}.`);
