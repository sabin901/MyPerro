import { describe, expect, it } from "vitest";
import {
  PLAY_REQUEST_DURATION_MS, REST_DURATION_MS, normaliseInteractionState,
  shouldRequestPlay, touchEndsRest,
} from "./interaction";

describe("companion interaction timing", () => {
  it("uses the requested 20 second message and one minute rest windows", () => {
    expect(PLAY_REQUEST_DURATION_MS).toBe(20_000);
    expect(REST_DURATION_MS).toBe(60_000);
  });

  it("requests play only after both inactivity and the anti-nag cooldown", () => {
    const state = { lastComfortAt: 1_000, lastRequestAt: 1_000 };
    expect(shouldRequestPlay(state, 30 * 60_000, 30, true, false)).toBe(false);
    expect(shouldRequestPlay(state, 30 * 60_000 + 1_001, 30, true, false)).toBe(true);
    expect(shouldRequestPlay(state, 90 * 60_000, 30, false, false)).toBe(false);
    expect(shouldRequestPlay(state, 90 * 60_000, 30, true, true)).toBe(false);
  });

  it("never starts by nagging a new or repaired profile", () => {
    expect(normaliseInteractionState(null, 50_000)).toEqual({ lastComfortAt: 50_000, lastRequestAt: 0 });
  });

  it("wakes a timed rest only for a touch on the pet", () => {
    expect(touchEndsRest(61_000, 1_000, true)).toBe(true);
    expect(touchEndsRest(61_000, 1_000, false)).toBe(false);
    expect(touchEndsRest(1_000, 1_001, true)).toBe(false);
  });
});
