#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const required = ["windows", "macArm", "macIntel", "linuxGnome", "linuxKde", "upgrade", "rollback"];
const [command, version] = process.argv.slice(2);
if (!command || !version) throw new Error("usage: npm run qa:evidence -- template|validate VERSION");
const path = resolve("release", "qa", `v${version.replace(/^v/, "")}.json`);
if (command === "template") {
  if (existsSync(path)) throw new Error(`${path} already exists; refusing to overwrite evidence`);
  const template = Object.fromEntries(required.map(key => [key, { status: "pending", tester: "", date: "", notes: "" }]));
  writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, { flag: "wx" });
  console.log(`Created ${path}. Replace pending only after a real clean-machine check.`);
  process.exit(0);
}
if (command !== "validate") throw new Error(`unknown command ${command}`);
const evidence = JSON.parse(readFileSync(path, "utf8"));
const invalid = required.filter(key => {
  const item = evidence[key];
  return item?.status !== "pass" || typeof item.tester !== "string" || !item.tester.trim()
    || !/^\d{4}-\d{2}-\d{2}$/.test(item.date ?? "") || typeof item.notes !== "string" || item.notes.trim().length < 8;
});
if (invalid.length) { console.error(`✗ incomplete acceptance evidence: ${invalid.join(", ")}`); process.exit(1); }
console.log(`✓ complete physical acceptance evidence for ${version}`);
