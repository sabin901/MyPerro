import { describe, expect, it } from "vitest";
import { advanceNeeds, applyCare, mostUrgentNeed, normaliseNeeds, petMood, wellbeingScore } from "./needs";

describe("virtual pet needs", () => {
  it("decays needs predictably and caps long offline decay", () => {
    const base = normaliseNeeds({ hunger: 80, thirst: 80, happiness: 80, energy: 80, updatedAt: 1 }, 1);
    expect(advanceNeeds(base, 3_600_001).hunger).toBe(76);
    expect(advanceNeeds(base, 48 * 3_600_000).hunger).toBe(48);
    expect(advanceNeeds(base, 3_600_001, true).energy).toBe(92);
  });

  it("care actions replenish the matching need", () => {
    const base = normaliseNeeds({ hunger: 20, thirst: 20, happiness: 20, energy: 50, updatedAt: 100 }, 100);
    expect(applyCare(base, "feed", 100).hunger).toBe(58);
    expect(applyCare(base, "water", 100).thirst).toBe(65);
    expect(applyCare(base, "play", 100).happiness).toBe(54);
    expect(applyCare(base, "rest", 100).energy).toBe(85);
  });

  it("asks for the most urgent need without ever reaching zero", () => {
    const state = normaliseNeeds({ hunger: -20, thirst: 18, happiness: 50, energy: 50, updatedAt: 1 }, 1);
    expect(state.hunger).toBe(5);
    expect(mostUrgentNeed(state)).toBe("hunger");
  });
});

describe("pet mood", () => {
  it("summarises balanced wellbeing", () => {
    const state = normaliseNeeds({ hunger: 90, thirst: 90, happiness: 90, energy: 90, updatedAt: 1 }, 1);
    expect(wellbeingScore(state)).toBe(90);
    expect(petMood(state)).toBe("thriving");
  });

  it("prioritises a critically low need over a good average", () => {
    const state = normaliseNeeds({ hunger: 100, thirst: 20, happiness: 100, energy: 100, updatedAt: 1 }, 1);
    expect(petMood(state)).toBe("needs-care");
  });
});
