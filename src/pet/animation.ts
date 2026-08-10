interface MotionSequence {
  cels: string[];
  frameMs: number;
}

/**
 * Purposeful cel rhythms. The state engine chooses the action; this layer gives
 * that action anticipation, contact and recovery instead of a mechanical A/B
 * flicker. Missing frames are filtered out for community-pack compatibility.
 */
const SEQUENCES: Record<string, MotionSequence> = {
  type_paw: { cels: ["type_paw", "type_paw_alt"], frameMs: 180 },
  type_intense: { cels: ["type_intense", "type_intense_alt"], frameMs: 90 },
  tail_wag: { cels: ["tail_wag", "tail_wag_alt", "tail_wag", "idle"], frameMs: 115 },
  walk: { cels: ["walk_a", "walk_b"], frameMs: 170 },
  walk_a: { cels: ["walk_a", "walk_b"], frameMs: 170 },
  walk_b: { cels: ["walk_b", "walk_a"], frameMs: 170 },
  run: { cels: ["run", "run_alt"], frameMs: 105 },
  chase: { cels: ["chase", "run_alt"], frameMs: 105 },
  zoomies: { cels: ["zoomies", "run_alt", "run"], frameMs: 90 },
  play: { cels: ["play", "tail_wag", "pet_happy", "tail_wag_alt"], frameMs: 145 },
  pet_happy: { cels: ["pet_happy", "pet_happy_alt"], frameMs: 220 },
  drink: { cels: ["drink", "drink_alt"], frameMs: 240 },
  eat: { cels: ["eat", "eat_alt"], frameMs: 210 },
  paper_unroll: { cels: ["paper_unroll", "paper_unroll_alt"], frameMs: 210 },
  sleep: { cels: ["sleep", "sleep_alt"], frameMs: 920 },
  lie_down: { cels: ["lie_down", "sleep_alt"], frameMs: 920 },
  happy_jump: { cels: ["tail_wag", "jump", "happy_jump", "land", "tail_wag_alt", "pet_happy"], frameMs: 140 },
  jump: { cels: ["jump", "happy_jump", "land"], frameMs: 140 },
  stretch: { cels: ["wake", "stretch", "yawn", "stretch"], frameMs: 420 },
  shake: { cels: ["shake", "drag", "shake", "land"], frameMs: 95 },
};

/** Pure animation-cel selection shared by tests and the native renderer. */
export function animatedCel(
  frame: string,
  now: number,
  available: ReadonlySet<string>,
): string {
  const base = frame.endsWith("_alt") ? frame.slice(0, -4) : frame;
  const sequence = SEQUENCES[base];
  if (!sequence) return available.has(frame) ? frame : base;
  const cels = sequence.cels.filter(cel => available.has(cel));
  if (cels.length === 0) return base;
  return cels[Math.floor(now / sequence.frameMs) % cels.length];
}
