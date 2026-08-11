import { describe, expect, it } from "vitest";
import {
  horizontalFacingLeft, mirroredSampleX, shouldMirrorFacing, travelFacingLeft,
} from "./direction";

describe("companion direction", () => {
  it("faces in the actual direction of travel", () => {
    expect(travelFacingLeft(500, 100)).toBe(true);
    expect(travelFacingLeft(100, 500)).toBe(false);
  });

  it("holds its previous direction inside the pointer dead zone", () => {
    expect(horizontalFacingLeft(100, 104, true, 8)).toBe(true);
    expect(horizontalFacingLeft(100, 96, false, 8)).toBe(false);
    expect(horizontalFacingLeft(100, 80, false, 8)).toBe(true);
  });

  it("mirrors left-authored locomotion only when facing right", () => {
    expect(shouldMirrorFacing(true, "left")).toBe(false);
    expect(shouldMirrorFacing(false, "left")).toBe(true);
    expect(shouldMirrorFacing(true, "right")).toBe(true);
    expect(shouldMirrorFacing(false, "right")).toBe(false);
    expect(shouldMirrorFacing(true, "front")).toBe(false);
  });

  it("samples the same visible pixel after a horizontal mirror", () => {
    expect(mirroredSampleX(0, 192, true)).toBe(191);
    expect(mirroredSampleX(191, 192, true)).toBe(0);
    expect(mirroredSampleX(42, 192, false)).toBe(42);
  });
});
