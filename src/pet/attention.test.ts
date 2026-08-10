import { describe, expect, it } from "vitest";
import { attentionMove } from "./attention";
import type { Viewport } from "./coords";

const viewport: Viewport = {
  winX: 100,
  winY: 100,
  scaleFactor: 1,
  displayScale: 2,
  cell: 96,
};
const monitor = { x: 0, y: 0, width: 1440, height: 900 };

describe("attentionMove", () => {
  it("does not move when disabled or reduced motion is enabled", () => {
    expect(attentionMove({
      cursor: { x: 900, y: 500 }, viewport, monitor, now: 3000, lastMovedAt: 0,
      reducedMotion: false, disabled: true,
    })).toBeNull();
    expect(attentionMove({
      cursor: { x: 900, y: 500 }, viewport, monitor, now: 3000, lastMovedAt: 0,
      reducedMotion: true, disabled: false,
    })).toBeNull();
  });

  it("ignores small cursor moves near the dog", () => {
    expect(attentionMove({
      cursor: { x: 220, y: 220 }, viewport, monitor, now: 3000, lastMovedAt: 0,
      reducedMotion: false, disabled: false,
    })).toBeNull();
  });

  it("moves below a far cursor so the dog sits nearby without covering it", () => {
    const move = attentionMove({
      cursor: { x: 900, y: 500 }, viewport, monitor, now: 3000, lastMovedAt: 0,
      reducedMotion: false, disabled: false,
    });
    expect(move?.next).toEqual({ x: 804, y: 542 });
    expect(move?.facingLeft).toBe(false);
  });

  it("respects the move cooldown", () => {
    expect(attentionMove({
      cursor: { x: 900, y: 500 }, viewport, monitor, now: 3000, lastMovedAt: 2500,
      reducedMotion: false, disabled: false,
    })).toBeNull();
  });

  it("clamps the destination inside the monitor", () => {
    const move = attentionMove({
      cursor: { x: 1400, y: 880 }, viewport, monitor, now: 3000, lastMovedAt: 0,
      reducedMotion: false, disabled: false,
    });
    expect(move?.next.x).toBeLessThanOrEqual(1440 - 18 - 192);
    expect(move?.next.y).toBeLessThanOrEqual(900 - 18 - 192);
  });
});
