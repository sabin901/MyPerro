import { clampToMonitor, windowSize, type Vec2, type Viewport } from "./coords";

export interface RoamArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoamPlan {
  start: Vec2;
  target: Vec2;
  startedAt: number;
  durationMs: number;
  anticipationMs: number;
  settleMs: number;
  gait: "walk" | "run";
  playful: boolean;
  /** Normalized portion of a playful trip spent rolling. */
  rollFrom: number;
  rollTo: number;
}

export interface PlanRoamArgs {
  viewport: Viewport;
  monitor: RoamArea;
  now: number;
  horizontalSeed: number;
  verticalSeed: number;
  playful: boolean;
  speedScale?: number;
  rollSeed?: number;
  rollChance?: number;
}

const MARGIN = 18;
const ANTICIPATION_MS = 420;
const SETTLE_MS = 560;

/**
 * Pick a natural desktop-pet destination. Most trips stay in the lower half of
 * the display like a floor-roaming animal, while a few climb higher so the pet
 * does not feel trapped on one rail.
 */
export function planRoam(args: PlanRoamArgs): RoamPlan | null {
  const size = windowSize(args.viewport);
  const usableW = Math.max(0, args.monitor.width - size.x - MARGIN * 2);
  const usableH = Math.max(0, args.monitor.height - size.y - MARGIN * 2);
  if (usableW < 8 || usableH < 8) return null;

  const hx = clamp01(args.horizontalSeed);
  const vy = clamp01(args.verticalSeed);
  const desired = {
    x: args.monitor.x + MARGIN + usableW * hx,
    // 72% of the time the companion travels along the desktop's lower band.
    y: args.monitor.y + MARGIN + usableH * (vy < .72 ? .70 + vy * .30 / .72 : (vy - .72) * .68 / .28),
  };
  const target = clampToMonitor(desired, args.viewport, args.monitor, {
    top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN,
  });
  const start = { x: args.viewport.winX, y: args.viewport.winY };
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  if (distance < 36) return null;

  const speedScale = Math.max(.7, Math.min(1.35, args.speedScale ?? 1));
  const speed = (args.playful ? 155 : 78) * speedScale;
  const travelMs = Math.max(args.playful ? 1700 : 2600, Math.min(10_000, distance / speed * 1000));
  const rolls = args.playful && clamp01(args.rollSeed ?? 0) < clamp01(args.rollChance ?? .5);
  return {
    start,
    target,
    startedAt: args.now,
    durationMs: ANTICIPATION_MS + travelMs + SETTLE_MS,
    anticipationMs: ANTICIPATION_MS,
    settleMs: SETTLE_MS,
    gait: args.playful || distance > 620 ? "run" : "walk",
    playful: args.playful,
    rollFrom: rolls ? .38 : 2,
    rollTo: rolls ? .64 : 2,
  };
}

export function roamProgress(plan: RoamPlan, now: number): number {
  const travelMs = Math.max(1, plan.durationMs - plan.anticipationMs - plan.settleMs);
  return clamp01((now - plan.startedAt - plan.anticipationMs) / travelMs);
}

export type RoamPhase = "anticipate" | "travel" | "settle" | "complete";

export function roamPhase(plan: RoamPlan, now: number): RoamPhase {
  const elapsed = now - plan.startedAt;
  if (elapsed < plan.anticipationMs) return "anticipate";
  if (elapsed < plan.durationMs - plan.settleMs) return "travel";
  if (elapsed < plan.durationMs) return "settle";
  return "complete";
}

/** Smooth acceleration/deceleration keeps OS-window movement from teleporting. */
export function roamPosition(plan: RoamPlan, now: number): Vec2 {
  const t = roamProgress(plan, now);
  const eased = t * t * (3 - 2 * t);
  return {
    x: plan.start.x + (plan.target.x - plan.start.x) * eased,
    y: plan.start.y + (plan.target.y - plan.start.y) * eased,
  };
}

export function isRoamRolling(plan: RoamPlan | null, now: number): boolean {
  if (!plan || roamPhase(plan, now) !== "travel") return false;
  const p = roamProgress(plan, now);
  return p >= plan.rollFrom && p <= plan.rollTo;
}

export function rollProgress(plan: RoamPlan | null, now: number): number {
  if (!plan || plan.rollTo <= plan.rollFrom) return 0;
  return clamp01((roamProgress(plan, now) - plan.rollFrom) / (plan.rollTo - plan.rollFrom));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
