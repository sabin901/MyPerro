import { describe, expect, it } from "vitest";
import { BUILT_IN_BREEDS } from "./settings";
import { allCompanionPersonalities, companionPersonality } from "./personality";

describe("companion personalities", () => {
  it("defines a bounded profile for every built-in companion", () => {
    const profiles = allCompanionPersonalities();
    expect(profiles.map(item => item.id)).toEqual([...BUILT_IN_BREEDS]);
    for (const profile of profiles) {
      expect(profile.tempo).toBeGreaterThanOrEqual(.75);
      expect(profile.tempo).toBeLessThanOrEqual(1.35);
      expect(profile.rollChance).toBeGreaterThanOrEqual(0);
      expect(profile.rollChance).toBeLessThanOrEqual(1);
      expect(profile.roamCooldownMs).toBeGreaterThan(0);
    }
  });

  it("makes energetic and calm companions behave differently", () => {
    const pom = companionPersonality("pomeranian");
    const midnight = companionPersonality("midnight-cat");
    expect(pom.tempo).toBeGreaterThan(midnight.tempo);
    expect(pom.roamAfterMs).toBeLessThan(midnight.roamAfterMs);
    expect(pom.rollChance).toBeGreaterThan(midnight.rollChance);
    expect(pom.voice.pitch).toBeGreaterThan(midnight.voice.pitch);
  });

  it("falls back safely for an unknown community pack", () => {
    expect(companionPersonality("community-friend").id).toBe("shiba-inu");
  });
});
