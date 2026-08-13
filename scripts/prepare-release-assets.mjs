#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const [inputDir, outputDir, rawTag, repository] = process.argv.slice(2);
if (!inputDir || !outputDir || !rawTag || !repository) {
  throw new Error("usage: prepare-release-assets.mjs INPUT OUTPUT TAG OWNER/REPO");
}

mkdirSync(outputDir, { recursive: true });
const version = rawTag.replace(/^v/, "");
const files = [];
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path); else files.push(path);
  }
};
walk(inputDir);

const one = (folderMarker, suffix) => {
  const matches = files.filter(file => file.includes(folderMarker) && file.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`expected one ${suffix} in ${folderMarker}; found ${matches.length}`);
  return matches[0];
};
const copy = (source, name = basename(source)) => {
  cpSync(source, join(outputDir, name));
  return name;
};
const signedPlatform = (folder, bundleSuffix, platform, outputName) => {
  const bundle = one(folder, bundleSuffix);
  const signature = `${bundle}.sig`;
  if (!existsSync(signature)) throw new Error(`missing updater signature for ${bundle}`);
  const name = copy(bundle, outputName ?? basename(bundle));
  copy(signature, `${name}.sig`);
  return {
    signature: readFileSync(signature, "utf8").trim(),
    url: `https://github.com/${repository}/releases/download/${rawTag}/${encodeURIComponent(name)}`,
  };
};

// Human-facing installers keep Tauri's architecture-qualified filenames.
for (const file of files.filter(file => /\.(dmg|exe|AppImage|deb)$/.test(file))) copy(file);
const sbom = files.find(file => file.endsWith("pawi-web.cdx.json"));
if (sbom) copy(sbom, "pawi-web.cdx.json");

const platforms = {
  "darwin-aarch64": signedPlatform("macos-apple-silicon", ".app.tar.gz", "darwin-aarch64", `Pawi_${version}_aarch64.app.tar.gz`),
  "darwin-x86_64": signedPlatform("macos-intel", ".app.tar.gz", "darwin-x86_64", `Pawi_${version}_x64.app.tar.gz`),
  "windows-x86_64": signedPlatform("windows-nsis", ".exe", "windows-x86_64"),
  "linux-x86_64": signedPlatform("linux-packages", ".AppImage", "linux-x86_64"),
};

writeFileSync(join(outputDir, "latest.json"), `${JSON.stringify({
  version,
  notes: `Pawi ${rawTag} — verified cross-platform update.`,
  pub_date: new Date().toISOString(),
  platforms,
}, null, 2)}\n`);

console.log(`Prepared ${Object.keys(platforms).length} signed updater targets for ${rawTag}.`);
