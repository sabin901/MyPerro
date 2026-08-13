import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const websiteDirectory = fileURLToPath(new URL(".", import.meta.url));

test("ships a complete Pawi public-beta website", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./site.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /<title>Pawi —/);
  assert.match(html, /Public beta builds/);
  assert.match(html, /pawi-companion-room\.jpg/);
  assert.match(html, /property="og:image" content="https:\/\/sabin901\.github\.io\/Pawi\/scenes\/pawi-companion-room\.jpg"/);
  assert.doesNotMatch(`${html}\n${script}`, /myperro|\bipet\b/i);
  await access(new URL("./assets/scenes/pawi-companion-room.jpg", import.meta.url));
});
