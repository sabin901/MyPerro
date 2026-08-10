export const PLAY_REQUEST_DURATION_MS = 20_000;
export const PLAY_REQUEST_BARK_INTERVAL_MS = 4_000;
export const REST_DURATION_MS = 60_000;

export interface CompanionInteractionState {
  lastComfortAt: number;
  lastRequestAt: number;
}

export function normaliseInteractionState(value: unknown, now = Date.now()): CompanionInteractionState {
  const raw = value && typeof value === "object"
    ? value as Partial<CompanionInteractionState>
    : {};
  return {
    lastComfortAt: validTimestamp(raw.lastComfortAt) ? raw.lastComfortAt! : now,
    lastRequestAt: validTimestamp(raw.lastRequestAt) ? raw.lastRequestAt! : 0,
  };
}

export function shouldRequestPlay(
  state: CompanionInteractionState,
  now: number,
  afterMinutes: number,
  enabled: boolean,
  quiet: boolean,
): boolean {
  if (!enabled || quiet || !Number.isFinite(afterMinutes) || afterMinutes <= 0) return false;
  const interval = afterMinutes * 60_000;
  return now - state.lastComfortAt >= interval && now - state.lastRequestAt >= interval;
}

export function touchEndsRest(restUntil: number, now: number, touchedPet: boolean): boolean {
  return touchedPet && restUntil > now;
}

function validTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
