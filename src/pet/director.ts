import type { Mode } from "./behaviour";
import { idleLifeFrame } from "./idleLife";
import { isRoamRolling, roamPhase, type RoamPlan } from "./roaming";

export type PresentationSource = "pose" | "roll" | "roam" | "play" | "attention" | "engine";

export interface TimedPose {
  frame: string;
  startedAt: number;
  until: number;
}

export interface PresentationInput {
  now: number;
  engineFrame: string;
  engineMode: Mode;
  lastActivityAt: number;
  availableFrames: ReadonlySet<string>;
  reducedMotion: boolean;
  pose: TimedPose | null;
  roam: RoamPlan | null;
  playUntil: number;
  attentionWalkUntil: number;
}

export interface Presentation {
  frame: string;
  source: PresentationSource;
  elapsedMs: number;
}

/** Ignore only the input event that initiated play; later direct work wins. */
export function shouldInterruptPlay(mode: Mode, now: number, inputGraceUntil: number): boolean {
  return mode !== "idle" && now >= inputGraceUntil;
}

function firstAvailable(available: ReadonlySet<string>, choices: string[], fallback: string): string {
  return choices.find(frame => available.has(frame)) ?? fallback;
}

/**
 * The single authority for the pose presented on screen. Native movement,
 * direct care, play, and passive engine reactions used to overwrite one
 * another in the render loop. Keeping the priority here makes conflicts
 * deterministic and regression-testable.
 */
export function resolvePresentation(input: PresentationInput): Presentation {
  const baseline = idleLifeFrame({
    frame: input.engineFrame,
    mode: input.engineMode,
    now: input.now,
    lastActivityAt: input.lastActivityAt,
    availableFrames: input.availableFrames,
    reducedMotion: input.reducedMotion,
  });

  // A deliberate pose (care, sleep, touch, shortcut, or preview) always owns
  // the body. Callers also stop native roaming when such a pose begins.
  if (input.pose && input.now < input.pose.until) {
    return {
      frame: firstAvailable(input.availableFrames, [input.pose.frame], baseline),
      source: "pose",
      elapsedMs: Math.max(0, input.now - input.pose.startedAt),
    };
  }

  if (input.roam) {
    const phase = roamPhase(input.roam, input.now);
    if (phase === "anticipate") {
      return {
        frame: firstAvailable(input.availableFrames, ["head_tilt", "stand", "idle"], baseline),
        source: "roam",
        elapsedMs: Math.max(0, input.now - input.roam.startedAt),
      };
    }
    if (phase === "settle") {
      return {
        frame: firstAvailable(
          input.availableFrames,
          input.roam.playful ? ["tail_wag", "sit_happy", "idle"] : ["sit_side", "idle"],
          baseline,
        ),
        source: "roam",
        elapsedMs: Math.max(0, input.now - (input.roam.startedAt + input.roam.durationMs - input.roam.settleMs)),
      };
    }
    if (isRoamRolling(input.roam, input.now)) {
      return {
        frame: firstAvailable(input.availableFrames, ["play", "pet_happy"], baseline),
        source: "roll",
        elapsedMs: Math.max(0, input.now - input.roam.startedAt),
      };
    }
    return {
      frame: firstAvailable(
        input.availableFrames,
        input.roam.gait === "run" ? ["run", "walk_a"] : ["walk_a", "walk"],
        baseline,
      ),
      source: "roam",
      elapsedMs: Math.max(0, input.now - input.roam.startedAt),
    };
  }

  if (input.now < input.playUntil) {
    return {
      frame: firstAvailable(
        input.availableFrames,
        input.reducedMotion ? ["tail_wag", "sit_happy"] : ["zoomies", "tail_wag"],
        baseline,
      ),
      source: "play",
      elapsedMs: Math.max(0, input.now - (input.playUntil - 9_000)),
    };
  }

  if (input.now < input.attentionWalkUntil) {
    return {
      frame: firstAvailable(input.availableFrames, ["walk_a", "walk"], baseline),
      source: "attention",
      elapsedMs: input.now,
    };
  }

  return { frame: baseline, source: "engine", elapsedMs: input.now };
}
