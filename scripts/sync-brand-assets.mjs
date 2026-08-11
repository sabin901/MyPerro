import { copyFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mark = resolve(root, "assets/brand/myperro-mark.svg");
const targets = [
  resolve(root, "website/assets/brand/myperro-mark.svg"),
  resolve(root, "src/art/brand/myperro-mark.svg"),
];

await readFile(mark, "utf8");
for (const target of targets) {
  await mkdir(resolve(target, ".."), { recursive: true });
  await copyFile(mark, target);
}

console.log(`Synced the canonical MyPerro mark to ${targets.length} product surfaces.`);
