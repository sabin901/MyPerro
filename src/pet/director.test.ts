import { describe, expect, it } from "vitest";
import { resolvePresentation, shouldInterruptPlay } from "./director";
import type { RoamPlan } from "./roaming";

const available = new Set([
  "idle", "head_tilt", "walk", "walk_a", "run", "play", "tail_wag", "eat", "zoomies",
]);

function roam(overrides: Partial<RoamPlan> = {}): RoamPlan {
  return {
    start: { x: 0, y: 0 }, target: { x: 500, y: 0 }, startedAt: 1_000,
    durationMs: 5_000, anticipationMs: 400, settleMs: 500,
    gait: "walk", playful: false, rollFrom: 2, rollTo: 2, ...overrides,
  };
}

function resolve(overrides: Partial<Parameters<typeof resolvePresentation>[0]> = {}) {
  return resolvePresentation({
    now: 2_000,
    engineFrame: "idle",
    engineMode: "idle",
    lastActivityAt: 2_000,
    availableFrames: available,
    reducedMotion: false,
    pose: null,
    roam: null,
    playUntil: 0,
    attentionWalkUntil: 0,
    ...overrides,
  });
}

describe("presentation director", () => {
  it("gives explicit care poses ownership over every passive behavior", () => {
    expect(resolve({
      pose: { frame: "eat", startedAt: 1_500, until: 3_000 },
      roam: roam(),
      playUntil: 10_000,
    })).toMatchObject({ frame: "eat", source: "pose", elapsedMs: 500 });
  });

  it("choreographs anticipation, travel, and settling around native movement", () => {
    const plan = roam();
    expect(resolve({ now: 1_200, roam: plan })).toMatchObject({ frame: "head_tilt", source: "roam" });
    expect(resolve({ now: 2_000, roam: plan })).toMatchObject({ frame: "walk_a", source: "roam" });
    expect(resolve({ now: 5_700, roam: plan })).toMatchObject({ frame: "idle", source: "roam" });
  });

  it("shows a real roll during playful travel instead of allowing zoomies to cover it", () => {
    const plan = roam({ playful: true, rollFrom: .35, rollTo: .65 });
    expect(resolve({ now: 3_050, roam: plan, playUntil: 10_000 })).toMatchObject({
      frame: "play", source: "roll",
    });
  });

  it("falls back safely when a requested pose is absent from a community pack", () => {
    expect(resolve({ pose: { frame: "drink", startedAt: 0, until: 3_000 } }).frame).toBe("idle");
  });

  it("protects only play's initiating input before yielding to direct activity", () => {
    expect(shouldInterruptPlay("normal", 1_500, 1_900)).toBe(false);
    expect(shouldInterruptPlay("normal", 2_000, 1_900)).toBe(true);
    expect(shouldInterruptPlay("idle", 2_000, 1_900)).toBe(false);
  });
});
