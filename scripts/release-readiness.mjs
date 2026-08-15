#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = new Set(process.argv.slice(2));
const stable = args.has("--stable");
const tagArg = process.argv.indexOf("--tag");
const tag = tagArg >= 0 ? process.argv[tagArg + 1] : "";
const readJson = path => JSON.parse(readFileSync(join(root, path), "utf8"));
const pkg = readJson("package.json");
const tauri = readJson("src-tauri/tauri.conf.json");
const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
const failures = [];
const checks = [];

function check(label, pass, detail) {
  checks.push({ label, pass, detail });
  if (!pass) failures.push(`${label}: ${detail}`);
}

check("version parity", pkg.version === tauri.version && pkg.version === cargoVersion,
  `package=${pkg.version}, tauri=${tauri.version}, cargo=${cargoVersion ?? "missing"}`);
check("product identity", tauri.productName === "Pawi" && tauri.identifier === "com.sabinraut.pawi",
  `${tauri.productName} / ${tauri.identifier}`);
check("creator attribution", pkg.author === "Sabin Raut" && /authors\s*=\s*\["Sabin Raut"\]/.test(cargo),
  "Sabin Raut must remain in npm and native package metadata");

const targets = new Set(tauri.bundle?.targets ?? []);
check("cross-platform bundles", ["dmg", "nsis", "appimage", "deb"].every(target => targets.has(target)),
  `configured: ${[...targets].join(", ")}`);
check("updater trust root", typeof tauri.plugins?.updater?.pubkey === "string" && tauri.plugins.updater.pubkey.length > 40,
  "a non-empty updater public key is required");

const artRoot = resolve(root, "art/exported");
const packs = existsSync(artRoot)
  ? readdirSync(artRoot, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name)
  : [];
check("built-in companions", packs.length === 9 && packs.every(id =>
  existsSync(join(artRoot, id, "atlas.json")) && existsSync(join(artRoot, id, "atlas.png"))),
"all nine built-in atlas JSON and PNG pairs must be present");

const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
check("native build matrix", ["windows-latest", "macos-15", "macos-15-intel", "ubuntu-22.04"]
  .every(os => workflow.includes(os)), "Windows, both Mac architectures, and Linux must build in CI");

if (stable) {
  check("stable semantic version", /^\d+\.\d+\.\d+$/.test(pkg.version) && Number(pkg.version.split(".")[0]) >= 1,
    `${pkg.version} is not a stable 1.x version`);
  check("tag matches version", tag === `v${pkg.version}`, `expected v${pkg.version}, received ${tag || "no tag"}`);
  check("Windows publisher certificate", process.env.HAS_WINDOWS_CERTIFICATE === "true",
    "configure WINDOWS_CERTIFICATE and WINDOWS_CERTIFICATE_PASSWORD");
  check("Apple Developer ID", process.env.HAS_APPLE_CERTIFICATE === "true",
    "configure Apple signing and notarization secrets");
  check("signed updater key", process.env.HAS_UPDATER_KEY === "true",
    "configure TAURI_SIGNING_PRIVATE_KEY and its password");

  const evidencePath = join(root, "release/qa", `v${pkg.version}.json`);
  let evidence = null;
  if (existsSync(evidencePath)) {
    try { evidence = JSON.parse(readFileSync(evidencePath, "utf8")); } catch { /* reported below */ }
  }
  const required = ["windows", "macArm", "macIntel", "linuxGnome", "linuxKde", "upgrade", "rollback"];
  check("physical acceptance evidence", evidence !== null && required.every(key => evidence[key]?.status === "pass"),
    `commit ${evidencePath} with pass evidence for ${required.join(", ")}`);
}

for (const item of checks) {
  console.log(`${item.pass ? "✓" : "✗"} ${item.label} — ${item.detail}`);
}
if (failures.length) process.exit(1);
console.log(stable ? "✓ stable-release gates satisfied" : "✓ repository-owned public-beta gates satisfied");
