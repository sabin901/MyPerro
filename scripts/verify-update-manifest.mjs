#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [source, expectedVersion] = process.argv.slice(2);
if (!source) throw new Error("usage: npm run update:verify -- PATH_OR_URL [EXPECTED_VERSION]");
const text = /^https:\/\//.test(source)
  ? await fetch(source).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); })
  : await readFile(source, "utf8");
const { validateUpdateManifest } = await import("../src/pet/updateManifest.ts");
const result = validateUpdateManifest(JSON.parse(text), expectedVersion);
if (!result.ok) { result.errors.forEach(error => console.error(`✗ ${error}`)); process.exit(1); }
console.log(`✓ signed update manifest contains all four platform targets${expectedVersion ? ` for ${expectedVersion}` : ""}`);
