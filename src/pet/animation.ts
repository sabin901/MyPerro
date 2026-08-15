interface MotionStep { cel: string; durationMs: number }
interface MotionSequence { steps: MotionStep[] }

const rhythm = (cels: string[], frameMs: number): MotionSequence => ({
  steps: cels.map(cel => ({ cel, durationMs: frameMs })),
});

/**
 * Purposeful cel rhythms. The state engine chooses the action; this layer gives
 * that action anticipation, contact and recovery instead of a mechanical A/B
 * flicker. Missing frames are filtered out for community-pack compatibility.
 */
const SEQUENCES: Record<string, MotionSequence> = {
  type_paw: rhythm(["type_paw", "type_paw_alt"], 180),
  type_intense: rhythm(["type_intense", "type_intense_alt"], 90),
  tail_wag: rhythm(["tail_wag", "tail_wag_alt"], 115),
  walk: rhythm(["walk_a", "walk_b"], 170),
  walk_a: rhythm(["walk_a", "walk_b"], 170),
  walk_b: rhythm(["walk_b", "walk_a"], 170),
  run: rhythm(["run", "run_alt"], 105),
  chase: rhythm(["chase", "run_alt"], 105),
  zoomies: rhythm(["zoomies", "run_alt", "run"], 90),
  play: rhythm(["play", "zoomies", "play"], 145),
  pet_happy: rhythm(["pet_happy", "pet_happy_alt"], 220),
  drink: rhythm(["drink", "drink_alt"], 240),
  eat: rhythm(["eat", "eat_alt"], 210),
  paper_unroll: rhythm(["paper_unroll", "paper_unroll_alt"], 210),
  sleep: rhythm(["sleep", "sleep_alt"], 920),
  lie_down: rhythm(["lie_down", "sleep_alt"], 920),
  happy_jump: rhythm(["jump", "happy_jump", "jump", "land"], 140),
  jump: rhythm(["jump", "happy_jump", "land"], 140),
  stretch: { steps: [
    { cel: "wake", durationMs: 260 }, { cel: "stretch", durationMs: 520 },
    { cel: "yawn", durationMs: 620 }, { cel: "stretch", durationMs: 360 },
  ] },
  shake: rhythm(["shake", "drag", "shake", "land"], 95),
};

/** Pure animation-cel selection shared by tests and the native renderer. */
export function animatedCel(
  frame: string,
  now: number,
  available: ReadonlySet<string>,
  tempo = 1,
): string {
  const base = frame.endsWith("_alt") ? frame.slice(0, -4) : frame;
  const sequence = SEQUENCES[base];
  if (!sequence) return available.has(frame) ? frame : base;
  const steps = sequence.steps.filter(step => available.has(step.cel));
  if (steps.length === 0) return base;
  const safeTempo = Number.isFinite(tempo) ? Math.max(.5, Math.min(1.75, tempo)) : 1;
  const cycleMs = steps.reduce((sum, step) => sum + step.durationMs, 0);
  let cursor = ((Math.max(0, now) * safeTempo) % cycleMs + cycleMs) % cycleMs;
  for (const step of steps) {
    if (cursor < step.durationMs) return step.cel;
    cursor -= step.durationMs;
  }
  return steps[steps.length - 1].cel;
}
