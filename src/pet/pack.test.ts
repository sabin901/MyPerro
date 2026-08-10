import { describe, it, expect } from "vitest";
import { validatePack, REQUIRED_ANIMATIONS, PACK_SCHEMA_VERSION, type AtlasInfo } from "./pack";

/** A minimal valid manifest, with every required animation present. */
function goodManifest() {
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  REQUIRED_ANIMATIONS.forEach((name, i) => {
    frames[name] = { x: (i % 5) * 96, y: Math.floor(i / 5) * 96, w: 96, h: 96 };
  });
  return {
    schemaVersion: PACK_SCHEMA_VERSION,
    id: "golden-retriever",
    name: "Golden Retriever",
    author: "Sabin",
    license: "CC-BY-4.0",
    canvas: { width: 96, height: 96 },
    frames,
  };
}

const bigAtlas: AtlasInfo = { width: 480, height: 384, hasAlpha: true };

describe("validatePack — the happy path", () => {
  it("accepts a well-formed manifest", () => {
    const r = validatePack(goodManifest(), bigAtlas);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe("validatePack — identity", () => {
  it("rejects a non-object", () => {
    expect(validatePack(null).ok).toBe(false);
    expect(validatePack("nope").ok).toBe(false);
  });

  it("rejects the wrong schema version", () => {
    const m = { ...goodManifest(), schemaVersion: 99 };
    expect(validatePack(m).errors.some(e => e.includes("schemaVersion"))).toBe(true);
  });

  it("rejects a bad id slug", () => {
    for (const bad of ["Golden Retriever", "golden_retriever", "gold--en", "-x", ""]) {
      const m = { ...goodManifest(), id: bad };
      expect(validatePack(m).ok, `id "${bad}" should fail`).toBe(false);
    }
  });

  it("accepts good id slugs", () => {
    for (const ok of ["shiba-inu", "husky", "dog2", "a-b-c"]) {
      const m = { ...goodManifest(), id: ok };
      expect(validatePack(m, bigAtlas).ok, `id "${ok}" should pass`).toBe(true);
    }
  });

  it("requires a licence — packs must declare one", () => {
    const m = { ...goodManifest(), license: "" };
    expect(validatePack(m).errors.some(e => e.includes("license"))).toBe(true);
  });
});

describe("validatePack — frames", () => {
  it("lists EVERY missing required animation, not just the first", () => {
    const m = goodManifest();
    delete (m.frames as any).idle;
    delete (m.frames as any).sleep;
    const r = validatePack(m, bigAtlas);
    expect(r.errors.some(e => e.includes('"idle"'))).toBe(true);
    expect(r.errors.some(e => e.includes('"sleep"'))).toBe(true);
  });

  it("rejects a frame with non-integer coordinates", () => {
    const m = goodManifest();
    (m.frames as any).idle = { x: 1.5, y: 0, w: 96, h: 96 };
    expect(validatePack(m, bigAtlas).ok).toBe(false);
  });

  it("rejects a frame that extends past the atlas edge", () => {
    const m = goodManifest();
    (m.frames as any).idle = { x: 450, y: 0, w: 96, h: 96 };  // 450+96 > 480
    const r = validatePack(m, bigAtlas);
    expect(r.errors.some(e => e.includes("outside"))).toBe(true);
  });

  it("warns (not errors) when a frame isn't the cell size", () => {
    const m = goodManifest();
    (m.frames as any).idle = { x: 0, y: 0, w: 64, h: 64 };
    const r = validatePack(m, bigAtlas);
    expect(r.ok).toBe(true);
    expect(r.warnings.some(w => w.includes("idle"))).toBe(true);
  });
});

describe("validatePack — atlas image", () => {
  it("rejects an atlas with no transparency", () => {
    const opaque: AtlasInfo = { width: 480, height: 384, hasAlpha: false };
    const r = validatePack(goodManifest(), opaque);
    expect(r.errors.some(e => e.includes("transparency"))).toBe(true);
  });

  it("still validates the manifest with no atlas provided", () => {
    expect(validatePack(goodManifest()).ok).toBe(true);
  });

  it("rejects artwork that can bleed across frame boundaries", () => {
    const bleeding: AtlasInfo = {
      width: 480, height: 384, hasAlpha: true, boundaryOpaqueRatio: 0.08,
    };
    const r = validatePack(goodManifest(), bleeding);
    expect(r.errors.some(e => e.includes("boundaries"))).toBe(true);
  });

  it("warns when named animations mostly reuse identical artwork", () => {
    const duplicated: AtlasInfo = {
      width: 480, height: 384, hasAlpha: true, uniqueVisualFrameRatio: 0.25,
    };
    const r = validatePack(goodManifest(), duplicated);
    expect(r.ok).toBe(true);
    expect(r.warnings.some(w => w.includes("visually unique"))).toBe(true);
  });

  it("rejects a mostly opaque rectangular frame even when its outer gutter is clear", () => {
    const blocked: AtlasInfo = {
      width: 480, height: 384, hasAlpha: true,
      boundaryOpaqueRatio: 0, maxFrameOpaqueRatio: 0.82,
    };
    const r = validatePack(goodManifest(), blocked);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("rectangular background"))).toBe(true);
  });
});

describe("validatePack — collects all problems at once", () => {
  it("returns multiple errors from one bad manifest", () => {
    const r = validatePack({ schemaVersion: 5, id: "Bad Id", frames: {} });
    expect(r.errors.length).toBeGreaterThan(5);
  });
});
