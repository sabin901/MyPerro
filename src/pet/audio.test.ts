import { describe, expect, it } from "vitest";
import { careSound, soundRecipe } from "./audio";

describe("companion sound design", () => {
  it("gives every care action an intentional sound", () => {
    expect(careSound("feed", "dog")).toBe("snack");
    expect(careSound("water", "dog")).toBe("slurp");
    expect(careSound("rest", "dog")).toBe("sleepy");
    expect(careSound("play", "dog")).toBe("yip");
    expect(careSound("play", "cat")).toBe("purr");
  });

  it("makes bark two-part and substantially louder than the old prototype", () => {
    const bark = soundRecipe("bark");
    expect(bark.voices).toHaveLength(2);
    expect(bark.masterGain).toBeGreaterThanOrEqual(.15);
    expect(bark.noise?.gain).toBeGreaterThan(0);
  });

  it("uses short rising notes for the post-meal happy cue", () => {
    const happy = soundRecipe("happy");
    expect(happy.voices.map(item => item.hz)).toEqual([...happy.voices.map(item => item.hz)].sort((a, b) => a - b));
    expect(Math.max(...happy.voices.map(item => item.delayMs + item.durationMs))).toBeLessThan(600);
  });

  it("keeps every recipe within a comfortable gain ceiling", () => {
    for (const name of ["bark", "purr", "chime", "snack", "slurp", "happy", "sleepy", "wake", "yip"] as const) {
      expect(soundRecipe(name).masterGain).toBeGreaterThan(0);
      expect(soundRecipe(name).masterGain).toBeLessThanOrEqual(.2);
    }
  });
});
