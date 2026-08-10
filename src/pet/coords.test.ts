import { describe, it, expect } from "vitest";
import {
  physicalToLogical, logicalToPhysical, globalToSprite,
  windowSize, windowCentre, normaliseVelocity, clampToMonitor, isStranded,
  type Viewport,
} from "./coords";

const v: Viewport = { winX: 100, winY: 200, scaleFactor: 2, displayScale: 2, cell: 96 };

describe("physical ↔ logical", () => {
  it("round-trips at any scale factor", () => {
    for (const sf of [1, 1.25, 1.5, 2, 3]) {
      const p = { x: 1234, y: 567 };
      const back = logicalToPhysical(physicalToLogical(p, sf), sf);
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it("halves physical coordinates on a 2x display", () => {
    expect(physicalToLogical({ x: 200, y: 100 }, 2)).toEqual({ x: 100, y: 50 });
  });

  it("treats a zero or negative scale factor as 1 instead of producing Infinity", () => {
    expect(physicalToLogical({ x: 10, y: 10 }, 0)).toEqual({ x: 10, y: 10 });
    expect(physicalToLogical({ x: 10, y: 10 }, -2)).toEqual({ x: 10, y: 10 });
    expect(physicalToLogical({ x: 10, y: 10 }, NaN)).toEqual({ x: 10, y: 10 });
  });
});

describe("globalToSprite", () => {
  it("maps the window origin to sprite pixel 0,0", () => {
    expect(globalToSprite({ x: 100, y: 200 }, v)).toEqual({ x: 0, y: 0 });
  });

  it("divides by display scale, not scale factor", () => {
    // 20 logical px into the window, at 2x magnification, is sprite pixel 10
    expect(globalToSprite({ x: 120, y: 220 }, v)).toEqual({ x: 10, y: 10 });
  });

  it("returns null outside the cell rather than a wrapped coordinate", () => {
    expect(globalToSprite({ x: 99, y: 250 }, v)).toBeNull();
    expect(globalToSprite({ x: 150, y: 199 }, v)).toBeNull();
    expect(globalToSprite({ x: 100 + 96 * 2, y: 250 }, v)).toBeNull();
    expect(globalToSprite({ x: 150, y: 200 + 96 * 2 }, v)).toBeNull();
  });

  it("includes the last pixel but excludes the one past it", () => {
    expect(globalToSprite({ x: 100 + 95 * 2, y: 200 }, v)).toEqual({ x: 95, y: 0 });
    expect(globalToSprite({ x: 100 + 96 * 2, y: 200 }, v)).toBeNull();
  });

  it("never returns a negative sprite coordinate", () => {
    for (let dx = -50; dx < 0; dx++) {
      expect(globalToSprite({ x: 100 + dx, y: 250 }, v)).toBeNull();
    }
  });
});

describe("window geometry", () => {
  it("computes logical size from cell and display scale", () => {
    expect(windowSize(v)).toEqual({ x: 192, y: 192 });
  });

  it("puts the centre halfway across", () => {
    expect(windowCentre(v)).toEqual({ x: 100 + 96, y: 200 + 96 });
  });

  it("96px cell at 2x is 192, not 224 — plan §9.3 arithmetic check", () => {
    expect(windowSize({ ...v, cell: 96, displayScale: 2 }).x).toBe(192);
  });
});

describe("normaliseVelocity", () => {
  it("converts physical px/s to logical px/s", () => {
    expect(normaliseVelocity(2400, 2)).toBe(1200);
  });

  it("means the chase threshold fires at the same real-world speed on any display", () => {
    const chase = 1200;
    expect(normaliseVelocity(2400, 2) >= chase).toBe(true);   // retina
    expect(normaliseVelocity(1200, 1) >= chase).toBe(true);   // 1x external
    expect(normaliseVelocity(1200, 2) >= chase).toBe(false);  // same physical speed, 2x → slower in logical terms
  });
});

describe("clampToMonitor", () => {
  const mon = { x: 0, y: 0, width: 1440, height: 900 };

  it("keeps the window fully on screen", () => {
    expect(clampToMonitor({ x: -500, y: -500 }, v, mon)).toEqual({ x: 0, y: 0 });
    expect(clampToMonitor({ x: 9999, y: 9999 }, v, mon)).toEqual({ x: 1440 - 192, y: 900 - 192 });
  });

  it("respects menu-bar and taskbar insets", () => {
    const insets = { top: 25, bottom: 60, left: 0, right: 0 };
    expect(clampToMonitor({ x: 0, y: 0 }, v, mon, insets).y).toBe(25);
    expect(clampToMonitor({ x: 0, y: 9999 }, v, mon, insets).y).toBe(900 - 60 - 192);
  });

  it("does not invert when the window is larger than the monitor", () => {
    const tiny = { x: 0, y: 0, width: 100, height: 100 };
    const r = clampToMonitor({ x: 50, y: 50 }, v, tiny);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("handles a monitor with a negative origin — a display to the left of the main one", () => {
    const left = { x: -1920, y: 0, width: 1920, height: 1080 };
    expect(clampToMonitor({ x: -5000, y: 0 }, v, left).x).toBe(-1920);
  });
});

describe("isStranded", () => {
  const main = { x: 0, y: 0, width: 1440, height: 900 };
  const second = { x: 1440, y: 0, width: 1920, height: 1080 };

  it("is fine when overlapping a monitor", () => {
    expect(isStranded({ ...v, winX: 100, winY: 100 }, [main])).toBe(false);
  });

  it("detects the window left behind after a display is unplugged", () => {
    const onSecond = { ...v, winX: 2000, winY: 300 };
    expect(isStranded(onSecond, [main, second])).toBe(false);
    expect(isStranded(onSecond, [main])).toBe(true);
  });

  it("counts partial overlap as not stranded", () => {
    expect(isStranded({ ...v, winX: 1440 - 10, winY: 0 }, [main])).toBe(false);
  });

  it("treats zero monitors as stranded rather than crashing", () => {
    expect(isStranded(v, [])).toBe(true);
  });
});
