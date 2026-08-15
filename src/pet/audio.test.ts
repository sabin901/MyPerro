import { describe, expect, it } from "vitest";
import { careSound, soundRecipe } from "./audio";

describe("companion sound design", () => {
  it("gives every care action an intentional sound", () => {
    expect(careSound("feed", "dog")).toBe("snack");
    expect(careSound("water", "dog")).toBe("slurp");
    expect(careSound("rest", "dog")).toBe("sleepy");
    expect(careSound("play", "dog")).toBe("yip");
    expect(careSound("play", "cat")).toBe("meow");
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
    for (const name of ["bark", "meow", "purr", "chime", "snack", "slurp", "happy", "sleepy", "wake", "yip"] as const) {
      expect(soundRecipe(name).masterGain).toBeGreaterThan(0);
      expect(soundRecipe(name).masterGain).toBeLessThanOrEqual(.2);
    }
  });

  it("uses a two-part rise and fall for a distinct cat call", () => {
    const meow = soundRecipe("meow");
    expect(meow.voices).toHaveLength(2);
    expect(meow.voices[0].endHz).toBeGreaterThan(meow.voices[0].hz);
    expect(meow.voices[1].endHz).toBeLessThan(meow.voices[1].hz);
  });

  it("tunes pitch and presence per companion without exceeding the safe ceiling", () => {
    const base = soundRecipe("yip");
    const tiny = soundRecipe("yip", { pitch: 1.3, presence: .8 });
    expect(tiny.voices[0].hz).toBeCloseTo(base.voices[0].hz * 1.3);
    expect(tiny.masterGain).toBeLessThan(base.masterGain);
    expect(tiny.masterGain).toBeLessThanOrEqual(.2);
  });
});
