import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "website/assets/pets");
const companions = [
  "shiba-inu", "pomeranian", "husky", "german-shepherd", "dalmatian",
  "lhasa-apso", "calico-cat", "midnight-cat", "cream-tabby",
];
const motionFrames = ["idle", "blink", "tail_wag", "walk_a", "walk_b", "happy_jump", "land", "pet_happy"];

await mkdir(output, { recursive: true });

for (const id of companions) {
  const folder = resolve(root, "art/exported", id);
  const [atlasBuffer, atlasJson] = await Promise.all([
    readFile(resolve(folder, "atlas.png")),
    readFile(resolve(folder, "atlas.json"), "utf8"),
  ]);
  const source = PNG.sync.read(atlasBuffer);
  const meta = JSON.parse(atlasJson);
  const frame = meta.frames.idle;
  const thumbnail = new PNG({ width: frame.w, height: frame.h });
  PNG.bitblt(source, thumbnail, frame.x, frame.y, frame.w, frame.h, 0, 0);
  await writeFile(resolve(output, `${id}.png`), PNG.sync.write(thumbnail, { colorType: 6 }));

  const motion = new PNG({ width: frame.w * motionFrames.length, height: frame.h });
  for (const [index, frameName] of motionFrames.entries()) {
    const motionFrame = meta.frames[frameName] ?? meta.frames.idle;
    PNG.bitblt(
      source,
      motion,
      motionFrame.x,
      motionFrame.y,
      motionFrame.w,
      motionFrame.h,
      index * frame.w,
      0,
    );
  }
  await writeFile(resolve(output, `${id}-motion.png`), PNG.sync.write(motion, { colorType: 6 }));
}

const heroFolder = resolve(root, "art/exported/shiba-inu");
await copyFile(resolve(heroFolder, "atlas.png"), resolve(output, "hero-atlas.png"));
await copyFile(resolve(heroFolder, "atlas.json"), resolve(output, "hero-atlas.json"));

console.log(`Built ${companions.length} companion previews, motion strips, and the animated hero atlas.`);
