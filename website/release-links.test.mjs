import test from "node:test";
import assert from "node:assert/strict";
import { downloadsFromRelease, platformFamily } from "./release-links.js";

test("never guesses a Mac architecture from its user agent", () => {
  assert.equal(platformFamily("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel"), "mac");
  assert.equal(platformFamily("Mozilla/5.0 (Macintosh; ARM Mac OS X)", "MacIntel"), "mac");
});

test("detects Windows and Linux families", () => {
  assert.equal(platformFamily("Windows NT 10.0", "Win32"), "windows");
  assert.equal(platformFamily("X11; Linux x86_64", "Linux x86_64"), "linux");
});

test("maps both native Mac DMGs from a GitHub release", () => {
  const release = downloadsFromRelease({
    tag_name: "v1.2.3",
    assets: [
      { name: "MyPerro_1.2.3_aarch64.dmg", browser_download_url: "https://example.test/arm.dmg" },
      { name: "MyPerro_1.2.3_x64.dmg", browser_download_url: "https://example.test/intel.dmg" },
    ],
  });
  assert.equal(release.tag, "v1.2.3");
  assert.equal(release.downloads["mac-arm"], "https://example.test/arm.dmg");
  assert.equal(release.downloads["mac-intel"], "https://example.test/intel.dmg");
});
