/**
 * Pure behaviour logic — no DOM, no Tauri, no canvas.
 *
 * Everything here is a function of its inputs, which means it can be tested
 * headlessly and reasoned about without launching the app. The Phase 2 state
 * machine grows out of this file; keeping it pure now is what makes that
 * cheap later.
 */

export type Mode = "sleeping" | "idle" | "normal" | "fast";

export interface Activity {
  cursor_x: number;
  cursor_y: number;
  cursor_velocity: number;
  keys_since_last: number;
  clicks_since_last: number;
  scroll_delta: number;
  idle_ms: number;
}

export interface Decision {
  frame: string;
  mode: Mode;
}

/** Frame budget per mode. The single biggest CPU lever in the app. */
export const FPS: Record<Mode, number> = {
  sleeping: 3,
  idle: 8,
  normal: 14,
  fast: 30,
};

/**
 * Tuning constants, isolated so Phase 2 can change feel without touching logic.
 * Every one of these is a guess until someone watches the dog for an hour.
 */
export const THRESHOLDS = {
  /** Master plan §13.3. Logical pixels per second, normalised for scale factor. */
  calmIdleMs: 60_000,
  sleepyMs: 300_000,
  sleepMs: 600_000,
  alertVelocity: 600,
  chaseVelocity: 1200,
  /** Keys per second, not per batch — see keysPerSecond() below. */
  typingKeysPerSec: 2,
  typingIntenseKeysPerSec: 8,
  degradedStaleMs: 3000,
};

/**
 * The Rust batch reports keys *since the last snapshot*, but the plan's
 * thresholds are keys *per second*. Converting here rather than at the call
 * site means changing the snapshot rate can't silently change the feel.
 */
export function keysPerSecond(keysInBatch: number, batchMs: number): number {
  return batchMs <= 0 ? 0 : (keysInBatch * 1000) / batchMs;
}

/**
 * Pick a frame and render mode from one activity batch.
 *
 * Order is priority order, highest first. Dragging wins over everything
 * because the user is physically holding the dog; typing beats cursor motion
 * because moving the mouse while typing is usually incidental.
 */
export function decide(
  a: Activity,
  opts: { dragging: boolean; batchMs?: number },
): Decision {
  if (opts.dragging) return { frame: "pet_happy", mode: "fast" };

  const kps = keysPerSecond(a.keys_since_last, opts.batchMs ?? 66);

  if (a.idle_ms > THRESHOLDS.sleepMs) return { frame: "sleep", mode: "sleeping" };
  if (kps >= THRESHOLDS.typingIntenseKeysPerSec) return { frame: "type_intense", mode: "normal" };
  if (kps >= THRESHOLDS.typingKeysPerSec) return { frame: "type_paw", mode: "normal" };
  if (a.cursor_velocity > THRESHOLDS.chaseVelocity) return { frame: "run", mode: "fast" };
  if (a.cursor_velocity > THRESHOLDS.alertVelocity) return { frame: "walk_a", mode: "normal" };
  // Sleepy is a distinct state from asleep (plan §13.3): same pose as calm
  // idle, but the frame budget drops, so it costs almost nothing to render.
  if (a.idle_ms > THRESHOLDS.sleepyMs) return { frame: "sit_side", mode: "sleeping" };
  if (a.idle_ms > THRESHOLDS.calmIdleMs) return { frame: "sit_side", mode: "idle" };
  return { frame: "idle", mode: "idle" };
}

/** Every frame `decide` is capable of returning. Tested against the real atlas. */
export const REACHABLE_FRAMES = [
  "pet_happy", "sleep", "type_intense", "type_paw", "run", "walk_a", "sit_side", "idle",
] as const;

export interface HitTestArgs {
  mask: Uint8Array;
  maskW: number;
  frame: { x: number; y: number };
  canvasW: number;
  canvasH: number;
  /** global cursor position */
  gx: number;
  gy: number;
  /** window top-left, logical pixels */
  winX: number;
  winY: number;
  scale: number;
  alphaThreshold: number;
}

/**
 * True when the global cursor sits over a non-transparent pixel of the current
 * frame. This is what decides whether clicks pass through to the app beneath.
 *
 * The bounds guard is load-bearing: a negative lx would otherwise wrap into
 * the previous row of the atlas and report a hit on a neighbouring sprite.
 */
export function isOverSprite(args: HitTestArgs): boolean {
  const lx = Math.floor((args.gx - args.winX) / args.scale);
  const ly = Math.floor((args.gy - args.winY) / args.scale);
  if (lx < 0 || ly < 0 || lx >= args.canvasW || ly >= args.canvasH) return false;
  const i = (args.frame.y + ly) * args.maskW + (args.frame.x + lx);
  if (i < 0 || i >= args.mask.length) return false;
  return args.mask[i] > args.alphaThreshold;
}

/** FPS governor. Returns true when enough time has passed to draw again. */
export function shouldDraw(now: number, lastDraw: number, mode: Mode): boolean {
  return now - lastDraw >= 1000 / FPS[mode];
}

/** Input monitoring considered unavailable after this long without a batch. */
export function isDegraded(now: number, lastActivityAt: number): boolean {
  return lastActivityAt === 0 || now - lastActivityAt > THRESHOLDS.degradedStaleMs;
}
