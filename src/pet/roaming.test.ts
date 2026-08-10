import { describe, expect, it } from "vitest";
import { isRoamRolling, planRoam, roamPosition, roamProgress, rollProgress, type RoamPlan } from "./roaming";
import type { Viewport } from "./coords";

const viewport: Viewport = { winX: 100, winY: 100, scaleFactor: 1, displayScale: 2, cell: 96 };
const monitor = { x: 0, y: 0, width: 1440, height: 900 };

describe("desktop roaming", () => {
  it("plans a clamped destination with a real travel duration", () => {
    const plan = planRoam({ viewport, monitor, now: 1000, horizontalSeed: .9, verticalSeed: .4, playful: false });
    expect(plan).not.toBeNull();
    expect(plan!.target.x).toBeLessThanOrEqual(1440 - 18 - 192);
    expect(plan!.target.y).toBeLessThanOrEqual(900 - 18 - 192);
    expect(plan!.durationMs).toBeGreaterThanOrEqual(2600);
    expect(plan!.gait).toBe("run");
  });

  it("moves continuously from start to destination", () => {
    const plan: RoamPlan = {
      start: { x: 0, y: 100 }, target: { x: 400, y: 300 }, startedAt: 1000,
      durationMs: 4000, gait: "walk", rollFrom: 2, rollTo: 2,
    };
    expect(roamPosition(plan, 1000)).toEqual(plan.start);
    expect(roamPosition(plan, 3000)).toEqual({ x: 200, y: 200 });
    expect(roamPosition(plan, 5000)).toEqual(plan.target);
    expect(roamProgress(plan, 6000)).toBe(1);
  });

  it("gives playful trips a bounded roll phase", () => {
    const plan = planRoam({ viewport, monitor, now: 0, horizontalSeed: .8, verticalSeed: .2, playful: true })!;
    const middleOfRoll = plan.durationMs * .51;
    expect(isRoamRolling(plan, middleOfRoll)).toBe(true);
    expect(rollProgress(plan, middleOfRoll)).toBeGreaterThan(0);
    expect(rollProgress(plan, middleOfRoll)).toBeLessThan(1);
    expect(isRoamRolling(plan, plan.durationMs * .9)).toBe(false);
  });

  it("does not plan movement when the monitor cannot fit the pet", () => {
    expect(planRoam({
      viewport, monitor: { x: 0, y: 0, width: 210, height: 210 }, now: 0,
      horizontalSeed: .5, verticalSeed: .5, playful: false,
    })).toBeNull();
  });
});
