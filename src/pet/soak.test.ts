import { describe, expect, it } from "vitest";
import { BehaviourEngine, STATES, type Signals } from "./engine";
import { resolvePresentation } from "./director";
import { allCompanionPersonalities } from "./personality";

const ALL_FRAMES = new Set([
  "idle", "sit", "sit_side", "stand", "side_eye", "head_tilt", "look_up", "blink",
  "tail_wag", "tail_wag_alt", "walk", "walk_a", "walk_b", "run", "run_alt", "chase", "turn",
  "drag", "type_paw", "type_paw_alt", "type_intense", "type_intense_alt", "focus_sit", "drink",
  "drink_alt", "eat", "eat_alt", "beg", "play", "zoomies", "pet_happy", "pet_happy_alt", "sleep",
  "sleep_alt", "lie_down", "wake", "stretch", "yawn", "alert", "bark", "scratch", "jump",
  "happy_jump", "shake", "land", "pant", "deliver_note", "paper_unroll", "paper_unroll_alt",
]);

function signals(step: number): Signals {
  const cycle = step % 180;
  return {
    dragging: cycle === 7,
    petting: cycle >= 12 && cycle < 15,
    shaking: false,
    chasing: cycle >= 20 && cycle < 23,
    alert: cycle === 30,
    scrolling: cycle >= 36 && cycle < 39,
    clicking: cycle === 45,
    typingKps: cycle >= 50 && cycle < 58 ? (cycle % 2 ? 3 : 9) : 0,
    idleMs: cycle > 150 ? 620_000 : cycle > 120 ? 320_000 : cycle * 1000,
    reminder: cycle === 70 ? "water" : cycle === 75 ? "stretch" : null,
    agentEvent: cycle === 90 ? "done" : cycle === 95 ? "error" : null,
    justWoke: cycle === 1,
    availableFrames: ALL_FRAMES,
    reducedMotion: step % 421 === 0,
  };
}

describe("eight-hour behavior soak", () => {
  it("keeps every companion in a defined, renderable and bounded state", () => {
    const stateIds = new Set(STATES.map(state => state.id));
    for (const personality of allCompanionPersonalities()) {
      const engine = new BehaviourEngine(0);
      let transitions = 0;
      for (let step = 1; step <= 8 * 60 * 60; step++) {
        const now = step * 1000;
        const input = signals(step);
        const output = engine.update(now, input);
        if (output.changed) transitions++;
        expect(stateIds.has(output.state)).toBe(true);
        expect(ALL_FRAMES.has(output.frame)).toBe(true);
        const presentation = resolvePresentation({
          now,
          engineFrame: output.frame,
          engineMode: output.mode,
          lastActivityAt: now - input.idleMs,
          availableFrames: ALL_FRAMES,
          reducedMotion: input.reducedMotion,
          idleStyle: personality.idleStyle,
          pose: null,
          roam: null,
          playUntil: step % 240 === 0 ? now + 9_000 : 0,
          attentionWalkUntil: 0,
        });
        expect(ALL_FRAMES.has(presentation.frame)).toBe(true);
        expect(Number.isFinite(presentation.elapsedMs)).toBe(true);
      }
      expect(transitions).toBeGreaterThan(100);
    }
  }, 30_000);
});
