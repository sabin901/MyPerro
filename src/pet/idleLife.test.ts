import { describe, expect, it } from "vitest";
import { idleLifeFrame } from "./idleLife";

const frames = new Set([
  "idle", "blink", "tail_wag", "head_tilt", "look_up", "side_eye", "scratch", "pant", "yawn", "sit_side",
  "stand",
]);

describe("idleLifeFrame", () => {
  it("leaves active states alone", () => {
    expect(idleLifeFrame({
      frame: "run", mode: "fast", now: 20_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("run");
  });

  it("waits a moment before adding autonomous motion", () => {
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 2_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("idle");
  });

  it("adds cute idle variety once the user has been quiet", () => {
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 11_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("tail_wag");
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 14_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("head_tilt");
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 25_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("side_eye");
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 31_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("scratch");
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 37_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("pant");
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 62_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false,
    })).toBe("stand");
  });

  it("uses calmer choices when reduced motion is enabled", () => {
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 21_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: true,
    })).toBe("sit_side");
  });

  it("gives playful and watchful companions distinct idle timing", () => {
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 7_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false, idleStyle: "playful",
    })).toBe("tail_wag");
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 7_000, lastActivityAt: 0,
      availableFrames: frames, reducedMotion: false, idleStyle: "watchful",
    })).toBe("blink");
  });

  it("falls back to the engine frame when a pack lacks the chosen idle frame", () => {
    expect(idleLifeFrame({
      frame: "idle", mode: "idle", now: 21_000, lastActivityAt: 0,
      availableFrames: new Set(["idle"]),
      reducedMotion: false,
    })).toBe("idle");
  });
});
