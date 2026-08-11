import { describe, expect, it } from "vitest";
import {
  INITIAL_UPDATE_CHECK_MS, UPDATE_CHECK_INTERVAL_MS, shouldPollForUpdates,
} from "./updatePolicy";

describe("installed update policy", () => {
  it("checks stable and signed release-candidate builds", () => {
    expect(shouldPollForUpdates("1.0.0")).toBe(true);
    expect(shouldPollForUpdates("0.9.0-rc.8")).toBe(true);
    expect(shouldPollForUpdates("1.0.0-beta.2")).toBe(true);
  });

  it("keeps development and malformed builds off the public channel", () => {
    expect(shouldPollForUpdates("0.0.0-dev")).toBe(false);
    expect(shouldPollForUpdates("0.9.0-local.4")).toBe(false);
    expect(shouldPollForUpdates("dev")).toBe(false);
    expect(shouldPollForUpdates("")).toBe(false);
    expect(shouldPollForUpdates("0.0.0")).toBe(false);
  });

  it("uses a prompt initial check and a restrained recurring interval", () => {
    expect(INITIAL_UPDATE_CHECK_MS).toBe(15_000);
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(21_600_000);
  });
});
