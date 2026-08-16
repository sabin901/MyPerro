import { describe, expect, it } from "vitest";
import { validateUpdateManifest } from "./updateManifest";

const valid = {
  version: "1.0.0-rc.1",
  pub_date: "2026-08-16T12:00:00Z",
  platforms: Object.fromEntries([
    "darwin-aarch64", "darwin-x86_64", "windows-x86_64", "linux-x86_64",
  ].map(platform => [platform, {
    url: `https://github.com/sabin901/Pawi/releases/download/v1.0.0-rc.1/Pawi_${platform}`,
    signature: "A".repeat(80),
  }])),
};

describe("update manifest acceptance", () => {
  it("accepts all four signed versioned targets", () => {
    expect(validateUpdateManifest(valid, "1.0.0-rc.1")).toEqual({ ok: true, errors: [] });
  });

  it("rejects missing, unsigned, or cross-version targets", () => {
    const broken = structuredClone(valid);
    delete broken.platforms["darwin-x86_64"];
    broken.platforms["linux-x86_64"].signature = "";
    broken.platforms["windows-x86_64"].url = "https://example.com/Pawi.exe";
    const result = validateUpdateManifest(broken, "1.0.0");
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});
