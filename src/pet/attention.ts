import { clampToMonitor, windowCentre, windowSize, type Vec2, type Viewport } from "./coords";

export interface AttentionArgs {
  cursor: Vec2;
  viewport: Viewport;
  monitor: { x: number; y: number; width: number; height: number };
  now: number;
  lastMovedAt: number;
  reducedMotion: boolean;
  disabled: boolean;
}

export interface AttentionMove {
  next: Vec2;
  facingLeft: boolean;
}

const ATTENTION_COOLDOWN_MS = 1600;
const MIN_DISTANCE = 240;

/**
 * Move the dog close to the user's cursor, but offset below it so the dog feels
 * attentive without blocking the thing the user is pointing at.
 */
export function attentionMove(args: AttentionArgs): AttentionMove | null {
  if (args.disabled || args.reducedMotion) return null;
  if (args.now - args.lastMovedAt < ATTENTION_COOLDOWN_MS) return null;

  const centre = windowCentre(args.viewport);
  const dx = args.cursor.x - centre.x;
  const dy = args.cursor.y - centre.y;
  if (Math.hypot(dx, dy) < MIN_DISTANCE) return null;

  const size = windowSize(args.viewport);
  const desired = {
    x: args.cursor.x - size.x / 2,
    y: args.cursor.y + 42,
  };
  const next = clampToMonitor(desired, args.viewport, args.monitor, {
    top: 18, right: 18, bottom: 18, left: 18,
  });
  if (Math.abs(next.x - args.viewport.winX) < 1 && Math.abs(next.y - args.viewport.winY) < 1) return null;

  return {
    next,
    facingLeft: next.x < args.viewport.winX,
  };
}
