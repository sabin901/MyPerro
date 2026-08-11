import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BehaviourEngine, SustainedDetector, ReversalDetector,
  STATES, stateById, type Signals, type StateId,
} from "./engine";

const atlas = JSON.parse(
  readFileSync(resolve(__dirname, "../../art/placeholder/shiba_placeholder.json"), "utf8"),
);
const available = new Set<string>(Object.keys(atlas.frames));

const quiet: Signals = {
  dragging: false, petting: false, shaking: false, chasing: false, alert: false,
  scrolling: false, clicking: false, typingKps: 0, idleMs: 0, reminder: null, agentEvent: null,
  justWoke: false, availableFrames: available, reducedMotion: false,
};
const sig = (o: Partial<Signals>): Signals => ({ ...quiet, ...o });

describe("SustainedDetector", () => {
  it("does not fire on a single fast sample — the anti-twitch rule", () => {
    const d = new SustainedDetector(200);
    expect(d.update(0, true)).toBe(false);
    expect(d.update(100, true)).toBe(false);
  });

  it("fires once the condition has held long enough", () => {
    const d = new SustainedDetector(200);
    d.update(0, true);
    expect(d.update(200, true)).toBe(true);
  });

  it("restarts the clock when the condition drops", () => {
    const d = new SustainedDetector(200);
    d.update(0, true);
    d.update(150, false);
    d.update(160, true);
    expect(d.update(300, true)).toBe(false);   // only 140ms of the new run
    expect(d.update(360, true)).toBe(true);
  });
});

describe("ReversalDetector", () => {
  it("needs the full number of reversals", () => {
    const d = new ReversalDetector(1500, 3);
    expect(d.update(0, 0)).toBe(false);
    expect(d.update(100, 10)).toBe(false);    // right
    expect(d.update(200, 0)).toBe(false);     // reversal 1
    expect(d.update(300, 10)).toBe(false);    // reversal 2
    expect(d.update(400, 0)).toBe(true);      // reversal 3
  });

  it("forgets reversals outside the window", () => {
    const d = new ReversalDetector(500, 3);
    d.update(0, 0); d.update(100, 10); d.update(200, 0); d.update(300, 10);
    expect(d.update(1200, 0)).toBe(false);    // earlier reversals expired
  });

  it("ignores jitter below the minimum delta", () => {
    const d = new ReversalDetector(1500, 2, 5);
    d.update(0, 0);
    for (let i = 1; i < 20; i++) d.update(i * 10, i % 2);   // ±1px noise
    expect(d.update(300, 1)).toBe(false);
  });
});

describe("state table integrity", () => {
  it("every state has a fallback that exists", () => {
    for (const s of STATES) expect(stateById(s.fallback), `${s.id} → ${s.fallback}`).toBeDefined();
  });

  it("no state's fallback is itself — that would be an inescapable loop", () => {
    const selfLoop = STATES.filter(s => s.fallback === s.id && s.id !== "idle");
    expect(selfLoop.map(s => s.id)).toEqual([]);
  });

  it("every non-interruptible state has a maxMs, or it could wedge forever", () => {
    const risky = STATES.filter(s => !s.interruptible && s.maxMs === undefined);
    expect(risky.map(s => s.id)).toEqual([]);
  });

  it("maxMs is always greater than minMs", () => {
    for (const s of STATES) {
      if (s.maxMs !== undefined) expect(s.maxMs, s.id).toBeGreaterThan(s.minMs);
    }
  });

  it("priorities follow the plan's ladder — drag outranks typing outranks idle", () => {
    const p = (id: StateId) => stateById(id)!.priority;
    expect(p("drag")).toBeLessThan(p("pet"));
    expect(p("pet")).toBeLessThan(p("reminder"));
    expect(p("reminder")).toBeLessThan(p("typing"));
    expect(p("click")).toBeLessThan(p("chase"));
    expect(p("typing")).toBeLessThan(p("chase"));
    expect(p("chase")).toBeLessThan(p("idle"));
  });
});

describe("engine — priority and interruption", () => {
  it("starts idle", () => {
    expect(new BehaviourEngine(0).state).toBe("idle");
  });

  it("drag preempts everything, immediately", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ typingKps: 20 }));
    expect(e.update(10, sig({ dragging: true, typingKps: 20 })).state).toBe("drag");
  });

  it("a reminder is non-interruptible for its minimum duration", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ reminder: "water" }));
    expect(e.state).toBe("reminder");
    // typing arrives 100ms in — too early to break the reminder
    expect(e.update(100, sig({ typingKps: 20 })).state).toBe("reminder");
    // after minMs it yields
    expect(e.update(1300, sig({ typingKps: 20 })).state).toBe("typing_intense");
  });

  it("but a drag still breaks a non-interruptible state — the user is holding the dog", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ reminder: "water" }));
    expect(e.update(100, sig({ dragging: true })).state).toBe("drag");
  });

  it("escalates typing intensity", () => {
    const e = new BehaviourEngine(0);
    expect(e.update(0, sig({ typingKps: 3 })).state).toBe("typing");
    expect(e.update(1000, sig({ typingKps: 12 })).state).toBe("typing_intense");
  });

  it("reacts to an ordinary click with a short attention bark", () => {
    const e = new BehaviourEngine(0);
    const out = e.update(0, sig({ clicking: true }));
    expect(out.state).toBe("click");
    expect(out.frame).toBe("bark");
  });
});

describe("engine — regression guards for bugs found in review", () => {
  // BUG A: pick() returned the current state without re-checking its trigger,
  // so a state persisted forever once entered, as long as nothing of higher
  // priority fired. The dog would get permanently stuck mid-behaviour.
  it("leaves a state as soon as its own trigger goes false", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ scrolling: true }));
    expect(e.state).toBe("scroll");
    const minMs = stateById("scroll")!.minMs;
    expect(e.update(minMs + 1, quiet).state).toBe("idle");
  });

  // BUG B: idle shares priority 12 with sleepy and asleep and sat first in the
  // table, so its always-true predicate shadowed both. The dog could never
  // sleep — the single most visible behaviour in the product.
  it("reaches sleepy and asleep despite idle sharing their priority", () => {
    const e1 = new BehaviourEngine(0);
    expect(e1.update(0, sig({ idleMs: 310_000 })).state).toBe("sleepy");
    const e2 = new BehaviourEngine(0);
    expect(e2.update(0, sig({ idleMs: 610_000 })).state).toBe("asleep");
  });

  it("asleep outranks sleepy — the more specific rest state wins", () => {
    const e = new BehaviourEngine(0);
    expect(e.update(0, sig({ idleMs: 900_000 })).state).toBe("asleep");
  });

  it("wakes out of sleep the moment activity returns", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ idleMs: 700_000 }));
    expect(e.state).toBe("asleep");
    expect(e.update(100, sig({ justWoke: true, idleMs: 0 })).state).toBe("wake");
  });
});

describe("engine — safety rules (plan §13.4)", () => {
  it("maxMs forces an exit even when the trigger is stuck on", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ agentEvent: "done" }));
    expect(e.state).toBe("agent");
    const maxMs = stateById("agent")!.maxMs!;
    expect(e.update(maxMs + 1, sig({ agentEvent: "done" })).state).toBe("idle");
  });

  it("cooldown prevents immediate re-entry", () => {
    const e = new BehaviourEngine(0);
    const def = stateById("agent")!;
    e.update(0, sig({ agentEvent: "done" }));
    e.update(def.maxMs! + 1, sig({ agentEvent: "done" }));   // forced out
    expect(e.state).toBe("idle");
    expect(e.update(def.maxMs! + 100, sig({ agentEvent: "done" })).state).toBe("idle");
    expect(e.update(def.maxMs! + def.cooldownMs + 200, sig({ agentEvent: "done" })).state).toBe("agent");
  });

  it("never wedges: 5000 random updates always leave a valid state", () => {
    const e = new BehaviourEngine(0);
    const ids = new Set(STATES.map(s => s.id));
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let now = 0;
    for (let i = 0; i < 5000; i++) {
      now += Math.floor(rnd() * 500);
      const out = e.update(now, sig({
        dragging: rnd() < 0.1, petting: rnd() < 0.1, chasing: rnd() < 0.1,
        alert: rnd() < 0.2, scrolling: rnd() < 0.1, clicking: rnd() < 0.08,
        typingKps: rnd() < 0.3 ? rnd() * 20 : 0,
        idleMs: rnd() * 700_000,
        reminder: rnd() < 0.05 ? "water" : null,
        agentEvent: rnd() < 0.03 ? "thinking" : rnd() < 0.06 ? "done" : null,
        justWoke: rnd() < 0.03,
      }));
      expect(ids.has(out.state)).toBe(true);
      expect(available.has(out.frame) || out.frame === "idle").toBe(true);
    }
  });

  it("returns to idle when every trigger goes quiet", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ chasing: true }));
    expect(e.state).toBe("chase");
    let t = 0;
    for (let i = 0; i < 50; i++) { t += 500; e.update(t, quiet); }
    expect(e.state).toBe("idle");
  });

  it("the watchdog can always force idle", () => {
    const e = new BehaviourEngine(0);
    e.update(0, sig({ reminder: "stretch" }));
    e.forceIdle(10);
    expect(e.state).toBe("idle");
  });
});

describe("engine — degradation", () => {
  it("uses the specific reminder art for water, stretch and notes", () => {
    const water = new BehaviourEngine(0).update(0, sig({ reminder: "water" }));
    expect(water.state).toBe("reminder");
    expect(water.frame).toBe("drink");

    const stretch = new BehaviourEngine(0).update(0, sig({ reminder: "stretch" }));
    expect(stretch.state).toBe("reminder");
    expect(stretch.frame).toBe("stretch");

    const note = new BehaviourEngine(0).update(0, sig({ reminder: "note" }));
    expect(note.state).toBe("reminder");
    expect(note.frame).toBe("deliver_note");
  });

  it("uses thinking and error art for AI-agent status", () => {
    const thinking = new BehaviourEngine(0).update(0, sig({ agentEvent: "thinking" }));
    expect(thinking.state).toBe("agent");
    expect(thinking.frame).toBe("head_tilt");
    expect(thinking.sound).toBeUndefined();

    const error = new BehaviourEngine(0).update(0, sig({ agentEvent: "error" }));
    expect(error.state).toBe("agent");
    expect(error.frame).toBe("alert");
    expect(error.sound).toBe("chime");
  });

  it("uses paper unroll art when the user scrolls", () => {
    const out = new BehaviourEngine(0).update(0, sig({ scrolling: true }));
    expect(out.state).toBe("scroll");
    expect(out.frame).toBe("paper_unroll");
  });

  it("falls back to idle art rather than crashing on a missing frame", () => {
    const e = new BehaviourEngine(0);
    const bare = new Set(["idle"]);
    const out = e.update(0, sig({ agentEvent: "done", availableFrames: bare }));
    expect(out.frame).toBe("idle");
  });

  it("uses the calm alternative under reduced motion", () => {
    const e = new BehaviourEngine(0);
    const out = e.update(0, sig({ chasing: true, reducedMotion: true }));
    expect(out.state).toBe("chase");
    expect(out.frame).toBe(stateById("chase")!.reducedMotion);
  });

  it("survives an atlas containing nothing useful", () => {
    const e = new BehaviourEngine(0);
    expect(() => e.update(0, sig({ availableFrames: new Set<string>() }))).not.toThrow();
  });
});

describe("engine — sound firing", () => {
  it("reports a sound exactly once per state entry, not every frame", () => {
    const e = new BehaviourEngine(0);
    const a = e.update(0, sig({ petting: true }));
    expect(a.changed).toBe(true);
    expect(a.sound).toBe("purr");
    const b = e.update(50, sig({ petting: true }));
    expect(b.changed).toBe(false);
    expect(b.sound).toBeUndefined();
  });
});
