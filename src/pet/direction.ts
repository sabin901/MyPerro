export type NativeFacing = "left" | "right" | "front";

/**
 * Resolve a desired horizontal facing with a dead zone. Keeping the previous
 * value near the centre prevents a stationary companion from flickering left
 * and right as a pointer jitters by a pixel.
 */
export function horizontalFacingLeft(
  subjectX: number,
  referenceX: number,
  previous: boolean,
  deadZone = 1,
): boolean {
  const delta = referenceX - subjectX;
  if (!Number.isFinite(delta) || Math.abs(delta) <= Math.max(0, deadZone)) return previous;
  return delta < 0;
}

/** Travel direction owns facing while an OS-window movement is in progress. */
export function travelFacingLeft(fromX: number, toX: number, previous = false): boolean {
  return horizontalFacingLeft(fromX, toX, previous, 0.5);
}

/**
 * Whether a cel must be mirrored to show the requested direction. Front-facing
 * artwork is never mirrored, so props, markings, and text-like shapes do not
 * jump sides for no visual reason.
 */
export function shouldMirrorFacing(desiredLeft: boolean, nativeFacing: NativeFacing): boolean {
  if (nativeFacing === "front") return false;
  return desiredLeft ? nativeFacing === "right" : nativeFacing === "left";
}

/** Mirror-aware alpha-mask sampling for asymmetric companion silhouettes. */
export function mirroredSampleX(x: number, width: number, mirrored: boolean): number {
  if (!mirrored) return x;
  return Math.max(0, width - 1 - x);
}
