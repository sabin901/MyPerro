import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  actualActivityAt, decide, isOverSprite, shouldDraw, isDegraded,
  FPS, THRESHOLDS, REACHABLE_FRAMES,
  type Activity, type Mode,
} from "./behaviour";

const quiet: Activity = {
  cursor_x: 0, cursor_y: 0, cursor_velocity: 0,
  keys_since_last: 0, clicks_since_last: 0, scroll_delta: 0, idle_ms: 0,
};
const a = (o: Partial<Activity>): Activity => ({ ...quiet, ...o });

it("distinguishes monitoring heartbeats from the last real user action", () => {
  expect(actualActivityAt(20_000, 12_000)).toBe(8_000);
  expect(actualActivityAt(2_000, 9_000)).toBe(0);
});

describe("decide — priority order", () => {
  it("dragging beats everything, including sleep", () => {
    const d = decide(a({ idle_ms: 999_999, keys_since_last: 50 }), { dragging: true });
    expect(d.frame).toBe("pet_happy");
    expect(d.mode).toBe("fast");
  });

  it("sleeps after the sleep threshold", () => {
    expect(decide(a({ idle_ms: THRESHOLDS.sleepMs + 1 }), { dragging: false }).mode).toBe("sleeping");
  });

  it("does NOT fully sleep one millisecond early", () => {
    expect(decide(a({ idle_ms: THRESHOLDS.sleepMs }), { dragging: false }).frame).not.toBe("sleep");
  });

  it("distinguishes calm idle, sleepy and asleep — plan §13.3 wants three states", () => {
    const calm   = decide(a({ idle_ms: THRESHOLDS.calmIdleMs + 1 }), { dragging: false });
    const sleepy = decide(a({ idle_ms: THRESHOLDS.sleepyMs + 1 }),   { dragging: false });
    const asleep = decide(a({ idle_ms: THRESHOLDS.sleepMs + 1 }),    { dragging: false });
    expect(calm.mode).toBe("idle");
    expect(sleepy.mode).toBe("sleeping");   // drowsy: same pose, far fewer frames
    expect(asleep.frame).toBe("sleep");
    expect(new Set([calm.mode, sleepy.mode, asleep.frame]).size).toBe(3);
  });

  it("typing beats cursor motion — mouse drift while typing is incidental", () => {
    const d = decide(a({ keys_since_last: 1, cursor_velocity: 5000 }), { dragging: false, batchMs: 200 });
    expect(d.frame).toBe("type_paw");
  });

  it("escalates to intense typing past the threshold", () => {
    expect(decide(a({ keys_since_last: 1 }), { dragging: false, batchMs: 100 }).frame)
      .toBe("type_intense");
  });

  it("chases a fast cursor", () => {
    expect(decide(a({ cursor_velocity: THRESHOLDS.chaseVelocity + 1 }), { dragging: false }).frame).toBe("run");
  });

  it("walks at moderate cursor speed", () => {
    expect(decide(a({ cursor_velocity: THRESHOLDS.alertVelocity + 1 }), { dragging: false }).frame).toBe("walk_a");
  });

  it("rests before sleeping", () => {
    expect(decide(a({ idle_ms: THRESHOLDS.calmIdleMs + 1 }), { dragging: false }).frame).toBe("sit_side");
  });

  it("falls through to idle", () => {
    expect(decide(quiet, { dragging: false }).frame).toBe("idle");
  });
});

describe("decide — totality", () => {
  it("never returns an unknown frame or mode, across a wide input sweep", () => {
    const modes = new Set<Mode>(["sleeping", "idle", "normal", "fast"]);
    const reachable = new Set<string>(REACHABLE_FRAMES);
    for (const idle of [0, 1, 59_999, 60_001, 299_999, 300_001, 599_999, 600_001, 9e9]) {
      for (const keys of [0, 1, 6, 7, 500]) {
        for (const vel of [0, 599, 601, 1199, 1201, 1e6]) {
          for (const dragging of [true, false]) {
            const d = decide(a({ idle_ms: idle, keys_since_last: keys, cursor_velocity: vel }), { dragging });
            expect(reachable.has(d.frame)).toBe(true);
            expect(modes.has(d.mode)).toBe(true);
          }
        }
      }
    }
  });

  it("is deterministic — same input, same output", () => {
    const input = a({ idle_ms: 30_000, cursor_velocity: 400 });
    expect(decide(input, { dragging: false })).toEqual(decide(input, { dragging: false }));
  });
});

describe("atlas contract", () => {
  const atlas = JSON.parse(
    readFileSync(resolve(__dirname, "../../art/placeholder/shiba_placeholder.json"), "utf8"),
  );

  it("every frame decide() can return exists in the real atlas", () => {
    const missing = REACHABLE_FRAMES.filter(f => !(f in atlas.frames));
    expect(missing).toEqual([]);
  });

  it("all atlas frames match the declared runtime cell", () => {
    const bad = Object.entries(atlas.frames as Record<string, any>)
      .filter(([, f]) => f.w !== atlas.canvas.width || f.h !== atlas.canvas.height)
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("frame rectangles sit on the grid and never overlap", () => {
    const seen = new Set<string>();
    for (const [name, f] of Object.entries(atlas.frames as Record<string, any>)) {
      expect(f.x % atlas.canvas.width, `${name}.x off grid`).toBe(0);
      expect(f.y % atlas.canvas.height, `${name}.y off grid`).toBe(0);
      const key = `${f.x},${f.y}`;
      expect(seen.has(key), `${name} overlaps another frame`).toBe(false);
      seen.add(key);
    }
  });
});

describe("isOverSprite", () => {
  // 128x96 mask, two 96x96 frames. Frame A: left half solid. Frame B: empty.
  const maskW = 128, maskH = 96;
  const mask = new Uint8Array(maskW * maskH);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) mask[y * maskW + x] = 255;

  const base = {
    mask, maskW, canvasW: 96, canvasH: 96,
    winX: 100, winY: 200, scale: 3, alphaThreshold: 8,
  };

  it("hits a solid pixel", () => {
    expect(isOverSprite({ ...base, frame: { x: 0, y: 0 }, gx: 100 + 30 * 3, gy: 200 + 30 * 3 })).toBe(true);
  });

  it("misses a transparent frame at the same coordinates", () => {
    expect(isOverSprite({ ...base, frame: { x: 96, y: 0 }, gx: 100 + 30 * 3, gy: 200 + 30 * 3 })).toBe(false);
  });

  it("returns false outside the window, in all four directions", () => {
    const f = { x: 0, y: 0 };
    expect(isOverSprite({ ...base, frame: f, gx: 99, gy: 250 })).toBe(false);
    expect(isOverSprite({ ...base, frame: f, gx: 150, gy: 199 })).toBe(false);
    expect(isOverSprite({ ...base, frame: f, gx: 100 + 96 * 3, gy: 250 })).toBe(false);
    expect(isOverSprite({ ...base, frame: f, gx: 150, gy: 200 + 96 * 3 })).toBe(false);
  });

  it("respects the window origin — moving the window moves the hit area", () => {
    const f = { x: 0, y: 0 };
    const gx = 100 + 10 * 3, gy = 200 + 10 * 3;
    expect(isOverSprite({ ...base, frame: f, gx, gy })).toBe(true);
    expect(isOverSprite({ ...base, winX: 500, winY: 600, frame: f, gx, gy })).toBe(false);
  });

  it("rejects out-of-window coordinates even when EVERY mask pixel is solid", () => {
    // The earlier out-of-window test passes even with a broken bounds check,
    // because a negative lx wraps to the previous atlas row which happened to
    // be empty. With a fully solid mask, only the bounds guard can save us —
    // so this test actually exercises it.
    const solid = new Uint8Array(maskW * maskH).fill(255);
    const args = { ...base, mask: solid, frame: { x: 0, y: 0 } };
    expect(isOverSprite({ ...args, gx: 99, gy: 250 })).toBe(false);           // left
    expect(isOverSprite({ ...args, gx: 100 - 3, gy: 250 })).toBe(false);      // further left
    expect(isOverSprite({ ...args, gx: 150, gy: 199 })).toBe(false);          // above
    expect(isOverSprite({ ...args, gx: 100 + 96 * 3, gy: 250 })).toBe(false); // right
    expect(isOverSprite({ ...args, gx: 150, gy: 200 + 96 * 3 })).toBe(false); // below
    expect(isOverSprite({ ...args, gx: 100, gy: 200 })).toBe(true);           // top-left corner IS inside
  });

  it("never reads outside the mask buffer", () => {
    expect(() => isOverSprite({
      ...base, frame: { x: 96, y: 0 }, canvasW: 96, canvasH: 96,
      gx: 100 + 63 * 3, gy: 200 + 63 * 3,
    })).not.toThrow();
  });
});

describe("FPS governor", () => {
  it("caps each mode at its budget", () => {
    for (const mode of Object.keys(FPS) as Mode[]) {
      let drawn = 0, last = -Infinity;
      for (let ms = 0; ms < 1000; ms++) {
        if (shouldDraw(ms, last, mode)) { drawn++; last = ms; }
      }
      expect(drawn).toBeLessThanOrEqual(FPS[mode]);
      expect(drawn).toBeGreaterThanOrEqual(FPS[mode] - 1);
    }
  });

  it("sleeping costs a tenth of fast mode", () => {
    expect(FPS.fast / FPS.sleeping).toBeGreaterThanOrEqual(10);
  });
});

describe("degraded-mode watchdog", () => {
  it("is degraded before any batch arrives", () => {
    expect(isDegraded(5000, 0)).toBe(true);
  });
  it("is healthy right after a batch", () => {
    expect(isDegraded(5000, 4990)).toBe(false);
  });
  it("degrades once batches stop", () => {
    expect(isDegraded(5000, 5000 - THRESHOLDS.degradedStaleMs - 1)).toBe(true);
  });
});
