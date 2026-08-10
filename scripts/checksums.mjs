#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
const bundle = process.argv[2]
  ? resolve(project, process.argv[2])
  : join(project, "src-tauri", "target", "release", "bundle");
if (!existsSync(bundle)) {
  console.error("No release bundle directory. Build installers first.");
  process.exit(1);
}
const files = [];
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (
      statSync(full).size > 0 &&
      !entry.name.endsWith(".sha256") &&
      entry.name !== "SHA256SUMS.txt"
    ) files.push(full);
  }
}
visit(bundle);
const lines = files.sort().map(file => {
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  return `${digest}  ${relative(bundle, file).replaceAll("\\", "/")}`;
});
const output = join(bundle, "SHA256SUMS.txt");
writeFileSync(output, lines.join("\n") + "\n");
console.log(`wrote ${basename(output)} for ${files.length} release files`);
