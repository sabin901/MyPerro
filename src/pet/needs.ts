export type CareAction = "feed" | "water" | "play" | "rest";
export type NeedKind = "hunger" | "thirst" | "happiness" | "energy";
export type PetMood = "thriving" | "happy" | "okay" | "needs-care";

export interface PetNeeds {
  hunger: number;
  thirst: number;
  happiness: number;
  energy: number;
  updatedAt: number;
}

const STORAGE_KEY = "myperro.pet-needs.v1";

export const DEFAULT_NEEDS: PetNeeds = {
  hunger: 82,
  thirst: 78,
  happiness: 86,
  energy: 88,
  updatedAt: 0,
};

const LOSS_PER_HOUR: Record<NeedKind, number> = {
  hunger: 4,
  thirst: 6,
  happiness: 2,
  energy: 1.5,
};

const clamp = (n: number) => Math.max(5, Math.min(100, Math.round(n * 10) / 10));

export function normaliseNeeds(value: unknown, now = Date.now()): PetNeeds {
  const raw = value && typeof value === "object" ? value as Partial<PetNeeds> : {};
  return {
    hunger: clamp(Number.isFinite(raw.hunger) ? raw.hunger! : DEFAULT_NEEDS.hunger),
    thirst: clamp(Number.isFinite(raw.thirst) ? raw.thirst! : DEFAULT_NEEDS.thirst),
    happiness: clamp(Number.isFinite(raw.happiness) ? raw.happiness! : DEFAULT_NEEDS.happiness),
    energy: clamp(Number.isFinite(raw.energy) ? raw.energy! : DEFAULT_NEEDS.energy),
    updatedAt: Number.isFinite(raw.updatedAt) && raw.updatedAt! > 0 ? raw.updatedAt! : now,
  };
}

/** Advance slowly and cap offline decay at eight hours to avoid guilt on return. */
export function advanceNeeds(value: PetNeeds, now = Date.now(), resting = false): PetNeeds {
  const state = normaliseNeeds(value, now);
  const hours = Math.max(0, Math.min(8, (now - state.updatedAt) / 3_600_000));
  return {
    hunger: clamp(state.hunger - LOSS_PER_HOUR.hunger * hours),
    thirst: clamp(state.thirst - LOSS_PER_HOUR.thirst * hours),
    happiness: clamp(state.happiness - LOSS_PER_HOUR.happiness * hours),
    energy: clamp(state.energy + (resting ? 12 : -LOSS_PER_HOUR.energy) * hours),
    updatedAt: now,
  };
}

export function applyCare(value: PetNeeds, action: CareAction, now = Date.now()): PetNeeds {
  const s = advanceNeeds(value, now);
  if (action === "feed") return { ...s, hunger: clamp(s.hunger + 38), happiness: clamp(s.happiness + 4) };
  if (action === "water") return { ...s, thirst: clamp(s.thirst + 45), happiness: clamp(s.happiness + 2) };
  if (action === "play") return {
    ...s, happiness: clamp(s.happiness + 34), energy: clamp(s.energy - 8), hunger: clamp(s.hunger - 4),
  };
  return { ...s, energy: clamp(s.energy + 35), happiness: clamp(s.happiness + 2) };
}

export function mostUrgentNeed(s: PetNeeds): NeedKind | null {
  const candidates: Array<[NeedKind, number]> = [
    ["thirst", s.thirst], ["hunger", s.hunger], ["energy", s.energy], ["happiness", s.happiness],
  ];
  const urgent = candidates.sort((a, b) => a[1] - b[1])[0];
  return urgent[1] < 28 ? urgent[0] : null;
}

export function wellbeingScore(s: PetNeeds): number {
  return Math.round((s.hunger + s.thirst + s.happiness + s.energy) / 4);
}

export function petMood(s: PetNeeds): PetMood {
  const score = wellbeingScore(s);
  const lowest = Math.min(s.hunger, s.thirst, s.happiness, s.energy);
  if (lowest < 28) return "needs-care";
  if (score >= 88) return "thriving";
  if (score >= 68) return "happy";
  return "okay";
}

export function moodMessage(mood: PetMood, petName: string): string {
  if (mood === "thriving") return `${petName} is thriving and loves being with you.`;
  if (mood === "happy") return `${petName} is happy and enjoying your company.`;
  if (mood === "okay") return `${petName} is doing okay, but would enjoy some company.`;
  return `${petName} needs a little help. Check the lowest meter.`;
}

export function needMessage(kind: NeedKind, petName: string): string {
  if (kind === "thirst") return `${petName} would love some fresh water.`;
  if (kind === "hunger") return `${petName}'s tummy is rumbling.`;
  if (kind === "energy") return `${petName} is ready for a cozy nap.`;
  return `${petName} wants a little play time.`;
}

export function loadNeeds(now = Date.now(), resting = false): PetNeeds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return advanceNeeds(normaliseNeeds(raw ? JSON.parse(raw) : null, now), now, resting);
  } catch {
    return normaliseNeeds(null, now);
  }
}

export function saveNeeds(value: PetNeeds): PetNeeds {
  const clean = normaliseNeeds(value);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch { /* degraded storage */ }
  return clean;
}
