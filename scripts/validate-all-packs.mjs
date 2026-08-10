#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../art/exported/", import.meta.url);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let failed = false;
for (const entry of readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/validate-pack.mjs", join(fileURLToPath(root), entry.name)],
    { cwd: projectRoot, stdio: "inherit", shell: false },
  );
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
