import type { Mode } from "./behaviour";
import type { IdleStyle } from "./personality";

export interface IdleLifeArgs {
  frame: string;
  mode: Mode;
  now: number;
  lastActivityAt: number;
  availableFrames: ReadonlySet<string>;
  reducedMotion: boolean;
  idleStyle?: IdleStyle;
}

const FULL_IDLE_SCRIPT = [
  { at: 0, frame: "idle" },
  { at: 4_000, frame: "blink" },
  { at: 8_000, frame: "tail_wag" },
  { at: 12_000, frame: "head_tilt" },
  { at: 17_000, frame: "look_up" },
  { at: 22_000, frame: "side_eye" },
  { at: 27_000, frame: "scratch" },
  { at: 34_000, frame: "pant" },
  { at: 41_000, frame: "yawn" },
  { at: 50_000, frame: "sit_side" },
  { at: 58_000, frame: "tail_wag" },
  { at: 61_000, frame: "stand" },
  { at: 63_000, frame: "look_up" },
] as const;

const CALM_IDLE_SCRIPT = [
  { at: 0, frame: "idle" },
  { at: 6_000, frame: "blink" },
  { at: 18_000, frame: "sit_side" },
] as const;

const PLAYFUL_IDLE_SCRIPT = [
  { at: 0, frame: "idle" },
  { at: 3_000, frame: "blink" },
  { at: 6_000, frame: "tail_wag" },
  { at: 10_000, frame: "head_tilt" },
  { at: 14_000, frame: "scratch" },
  { at: 19_000, frame: "stand" },
  { at: 24_000, frame: "side_eye" },
  { at: 31_000, frame: "tail_wag" },
  { at: 39_000, frame: "pant" },
  { at: 48_000, frame: "look_up" },
  { at: 58_000, frame: "tail_wag" },
  { at: 64_000, frame: "idle" },
] as const;

const WATCHFUL_IDLE_SCRIPT = [
  { at: 0, frame: "idle" },
  { at: 7_000, frame: "blink" },
  { at: 14_000, frame: "look_up" },
  { at: 22_000, frame: "side_eye" },
  { at: 31_000, frame: "head_tilt" },
  { at: 42_000, frame: "sit_side" },
  { at: 54_000, frame: "stand" },
  { at: 63_000, frame: "blink" },
] as const;

const SCRIPT_MS = 70_000;

/**
 * Adds tiny autonomous motions while the dog is otherwise idle. This is kept
 * pure so the "feels alive" layer can be tested without a canvas or Tauri.
 */
export function idleLifeFrame(args: IdleLifeArgs): string {
  if (args.mode !== "idle") return args.frame;
  if (!["idle", "sit_side", "focus_sit"].includes(args.frame)) return args.frame;

  const idleFor = args.lastActivityAt === 0 ? args.now : args.now - args.lastActivityAt;
  if (idleFor < 2_500) return args.frame;

  const script = args.reducedMotion || args.idleStyle === "calm"
    ? CALM_IDLE_SCRIPT
    : args.idleStyle === "playful"
      ? PLAYFUL_IDLE_SCRIPT
      : args.idleStyle === "watchful"
        ? WATCHFUL_IDLE_SCRIPT
        : FULL_IDLE_SCRIPT;
  const t = Math.max(0, idleFor % SCRIPT_MS);
  let chosen = args.frame;
  for (const item of script) {
    if (t >= item.at) chosen = item.frame;
    else break;
  }

  return args.availableFrames.has(chosen) ? chosen : args.frame;
}
