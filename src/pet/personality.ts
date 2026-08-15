import { BUILT_IN_BREEDS } from "./settings";

export type CompanionSpecies = "dog" | "cat";
export type IdleStyle = "bright" | "playful" | "watchful" | "calm";

export interface CompanionVoiceProfile {
  /** Multiplies every oscillator frequency without changing the recipe rhythm. */
  pitch: number;
  /** Softens or strengthens the transient portion of the voice. */
  presence: number;
}

export interface CompanionPersonality {
  id: string;
  species: CompanionSpecies;
  nature: string;
  idleStyle: IdleStyle;
  /** Higher values animate and travel faster. */
  tempo: number;
  /** Quiet time required before autonomous roaming begins. */
  roamAfterMs: number;
  /** Minimum pause between autonomous trips. */
  roamCooldownMs: number;
  /** Chance that a playful trip includes a complete roll. */
  rollChance: number;
  voice: CompanionVoiceProfile;
}

const PROFILES: Record<(typeof BUILT_IN_BREEDS)[number], CompanionPersonality> = {
  "shiba-inu": {
    id: "shiba-inu", species: "dog", nature: "Bright and curious", idleStyle: "bright", tempo: 1.08,
    roamAfterMs: 7_000, roamCooldownMs: 5_000, rollChance: .48,
    voice: { pitch: 1.06, presence: .96 },
  },
  pomeranian: {
    id: "pomeranian", species: "dog", nature: "Bouncy and social", idleStyle: "playful", tempo: 1.2,
    roamAfterMs: 5_500, roamCooldownMs: 4_200, rollChance: .68,
    voice: { pitch: 1.34, presence: .84 },
  },
  husky: {
    id: "husky", species: "dog", nature: "Chatty and adventurous", idleStyle: "playful", tempo: 1.14,
    roamAfterMs: 6_000, roamCooldownMs: 4_600, rollChance: .62,
    voice: { pitch: .86, presence: 1.08 },
  },
  "german-shepherd": {
    id: "german-shepherd", species: "dog", nature: "Loyal and watchful", idleStyle: "watchful", tempo: .94,
    roamAfterMs: 8_500, roamCooldownMs: 6_500, rollChance: .28,
    voice: { pitch: .78, presence: 1.12 },
  },
  dalmatian: {
    id: "dalmatian", species: "dog", nature: "Lively and bright", idleStyle: "bright", tempo: 1.12,
    roamAfterMs: 6_500, roamCooldownMs: 4_800, rollChance: .55,
    voice: { pitch: .98, presence: 1 },
  },
  "lhasa-apso": {
    id: "lhasa-apso", species: "dog", nature: "Gentle and calm", idleStyle: "calm", tempo: .86,
    roamAfterMs: 10_000, roamCooldownMs: 7_500, rollChance: .25,
    voice: { pitch: 1.18, presence: .82 },
  },
  "calico-cat": {
    id: "calico-cat", species: "cat", nature: "Clever and affectionate", idleStyle: "bright", tempo: 1.02,
    roamAfterMs: 8_000, roamCooldownMs: 6_000, rollChance: .52,
    voice: { pitch: 1.13, presence: .76 },
  },
  "midnight-cat": {
    id: "midnight-cat", species: "cat", nature: "Quiet and mysterious", idleStyle: "watchful", tempo: .82,
    roamAfterMs: 11_000, roamCooldownMs: 8_000, rollChance: .22,
    voice: { pitch: .88, presence: .7 },
  },
  "cream-tabby": {
    id: "cream-tabby", species: "cat", nature: "Cozy and easygoing", idleStyle: "calm", tempo: .9,
    roamAfterMs: 9_500, roamCooldownMs: 7_000, rollChance: .36,
    voice: { pitch: 1.02, presence: .72 },
  },
};

const FALLBACK = PROFILES["shiba-inu"];

export function companionPersonality(breed: string): CompanionPersonality {
  return PROFILES[breed as keyof typeof PROFILES] ?? FALLBACK;
}

export function allCompanionPersonalities(): readonly CompanionPersonality[] {
  return BUILT_IN_BREEDS.map(companionPersonality);
}
