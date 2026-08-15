/**
 * Phase 6 — dog-pack format and validator.
 *
 * A "dog pack" is how the community adds a new breed without touching the app's
 * code: an atlas PNG, a manifest JSON, and a licence. This file defines the
 * manifest shape and, crucially, *validates* it before anything is loaded.
 *
 * Why validation matters: a pack is untrusted, downloaded content. A malformed
 * or malicious manifest must be rejected with a clear reason, never silently
 * loaded into a state where it could crash the app or point frames at pixels
 * outside the atlas. The validator returns a list of human-readable problems,
 * so a pack author knows exactly what to fix.
 */

/** The animations every pack MUST provide, or the dog can't do the basics. */
export const REQUIRED_ANIMATIONS = [
  "idle", "sleep", "walk_a", "sit_side", "type_paw", "pet_happy", "drag",
] as const;

export interface PackFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackManifest {
  schemaVersion: number;
  id: string;
  name: string;
  author: string;
  license: string;
  canvas: { width: number; height: number };
  frames: Record<string, PackFrame>;
  /** Native direction of each cel. Front poses are never horizontally flipped. */
  frameFacing?: Record<string, "left" | "right" | "front">;
}

export const PACK_SCHEMA_VERSION = 1;

/** What we know about the atlas image the manifest is paired with. */
export interface AtlasInfo {
  width: number;
  height: number;
  /** True when the PNG has an alpha channel; a desktop pet needs transparency. */
  hasAlpha: boolean;
  /** Fraction of frame-edge pixels that are opaque. Zero is ideal. */
  boundaryOpaqueRatio?: number;
  /** Fraction of frames whose rendered pixel content is genuinely distinct. */
  uniqueVisualFrameRatio?: number;
  /** Highest opaque-pixel fraction in any frame. Catches keyed backdrop blocks. */
  maxFrameOpaqueRatio?: number;
  /** Pixel spread between the lowest opaque points in locomotion cels. */
  locomotionBaselineSpread?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a parsed manifest, optionally against the real atlas dimensions.
 * Returns every problem found, not just the first — a pack author shouldn't
 * have to fix-and-retry one error at a time.
 */
export function validatePack(raw: unknown, atlas?: AtlasInfo): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["manifest is not an object"], warnings };
  }
  const m = raw as Record<string, unknown>;

  // ── identity fields ──
  if (m.schemaVersion !== PACK_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PACK_SCHEMA_VERSION}, got ${JSON.stringify(m.schemaVersion)}`);
  }
  requireString(m.id, "id", errors);
  requireString(m.name, "name", errors);
  requireString(m.author, "author", errors);
  requireString(m.license, "license", errors);

  // id must be a safe slug — it becomes a folder name and a settings key.
  if (typeof m.id === "string" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id)) {
    errors.push(`id "${m.id}" must be lowercase letters, numbers and single hyphens`);
  }

  if (typeof m.license === "string" && m.license.trim() === "") {
    errors.push("license must not be empty — every pack must declare one");
  }

  // ── canvas ──
  const canvas = m.canvas as Record<string, unknown> | undefined;
  const cw = canvas?.width, ch = canvas?.height;
  if (!isPositiveInt(cw) || !isPositiveInt(ch)) {
    errors.push("canvas.width and canvas.height must be positive integers");
  } else if (cw !== ch) {
    warnings.push(`canvas is ${cw}x${ch}; square cells are strongly recommended`);
  }

  // ── frames ──
  const frames = m.frames as Record<string, unknown> | undefined;
  if (typeof frames !== "object" || frames === null) {
    errors.push("frames must be an object mapping name → {x,y,w,h}");
  } else {
    for (const [name, f] of Object.entries(frames)) {
      const fr = f as Record<string, unknown>;
      if (![fr?.x, fr?.y, fr?.w, fr?.h].every(isNonNegInt)) {
        errors.push(`frame "${name}" must have integer x,y,w,h`);
        continue;
      }
      // A frame must sit inside the atlas, or drawImage reads garbage.
      if (atlas) {
        if ((fr.x as number) + (fr.w as number) > atlas.width ||
            (fr.y as number) + (fr.h as number) > atlas.height) {
          errors.push(`frame "${name}" extends outside the ${atlas.width}x${atlas.height} atlas`);
        }
      }
      // Frame size should match the declared cell.
      if (isPositiveInt(cw) && isPositiveInt(ch) && (fr.w !== cw || fr.h !== ch)) {
        warnings.push(`frame "${name}" is ${fr.w}x${fr.h}, not the ${cw}x${ch} cell size`);
      }
    }

    // Required animations must all be present.
    for (const need of REQUIRED_ANIMATIONS) {
      if (!(need in frames)) errors.push(`missing required animation "${need}"`);
    }
  }

  // ── native frame direction ──
  // Optional for schema-v1 community packs (legacy art is right-facing), but
  // when supplied it is strict: invalid or orphaned metadata would make the
  // visible sprite disagree with movement and pointer hit-testing.
  const frameFacing = m.frameFacing;
  if (frameFacing !== undefined) {
    if (typeof frameFacing !== "object" || frameFacing === null || Array.isArray(frameFacing)) {
      errors.push("frameFacing must map frame names to left, right, or front");
    } else {
      for (const [name, direction] of Object.entries(frameFacing)) {
        if (direction !== "left" && direction !== "right" && direction !== "front") {
          errors.push(`frameFacing.${name} must be left, right, or front`);
        }
        if (!frames || typeof frames !== "object" || !(name in frames)) {
          errors.push(`frameFacing references unknown frame "${name}"`);
        }
      }
    }
  }

  // ── atlas image ──
  if (atlas && !atlas.hasAlpha) {
    errors.push("atlas PNG has no transparency; the dog would render on a solid block");
  }
  if (atlas?.boundaryOpaqueRatio !== undefined) {
    if (atlas.boundaryOpaqueRatio > 0.02) {
      errors.push(`atlas content touches frame boundaries (${(atlas.boundaryOpaqueRatio * 100).toFixed(1)}% opaque); add a transparent gutter`);
    } else if (atlas.boundaryOpaqueRatio > 0) {
      warnings.push(`atlas has ${(atlas.boundaryOpaqueRatio * 100).toFixed(2)}% opaque boundary pixels`);
    }
  }
  if (atlas?.uniqueVisualFrameRatio !== undefined && atlas.uniqueVisualFrameRatio < 0.6) {
    warnings.push(`only ${(atlas.uniqueVisualFrameRatio * 100).toFixed(0)}% of named frames are visually unique; add real animation cels`);
  }
  if (atlas?.maxFrameOpaqueRatio !== undefined && atlas.maxFrameOpaqueRatio > 0.7) {
    errors.push(`an atlas frame is ${(atlas.maxFrameOpaqueRatio * 100).toFixed(0)}% opaque; remove the rectangular background`);
  }
  if (atlas?.locomotionBaselineSpread !== undefined && atlas.locomotionBaselineSpread > 6) {
    errors.push(`locomotion feet drift by ${atlas.locomotionBaselineSpread}px; align walk/run cels to one ground line`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── small helpers, kept obvious ──

function requireString(v: unknown, field: string, errors: string[]) {
  if (typeof v !== "string" || v.trim() === "") errors.push(`${field} must be a non-empty string`);
}
function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}
function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}
