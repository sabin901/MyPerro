/**
 * Phase 2 — the behaviour engine.
 *
 * Master plan §13. Deterministic and pure: `update()` is a function of the
 * engine's own state plus the signals handed to it, and takes `now` as an
 * argument rather than reading the clock. That means the whole thing can be
 * driven frame-by-frame in a test without timers, which is the only realistic
 * way to verify "the dog never gets stuck".
 *
 * Replaces the flat if-chain in behaviour.ts, which had no timing, no
 * hysteresis and no cooldowns.
 */

import type { Mode } from "./behaviour";

// ─── Detectors ────────────────────────────────────────────────────────────────

/**
 * Fires only once a condition has held continuously for `holdMs`.
 *
 * Plan §13.3 wants chase to require 1200 px/s *sustained for 200 ms*, not one
 * fast sample. Without this the dog lunges at every stray flick of the mouse,
 * which reads as twitchy rather than alert.
 */
export class SustainedDetector {
  private since: number | null = null;
  constructor(private readonly holdMs: number) {}

  update(now: number, active: boolean): boolean {
    if (!active) { this.since = null; return false; }
    if (this.since === null) this.since = now;
    return now - this.since >= this.holdMs;
  }

  reset() { this.since = null; }
}

/**
 * Counts direction reversals inside a rolling window.
 *
 * Used twice: petting (3 strokes over the head in 1.5 s) and shaking
 * (3 reversals while dragging in 800 ms). Same shape, different windows.
 */
export class ReversalDetector {
  private reversals: number[] = [];
  private lastSign = 0;
  private lastValue: number | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly needed: number,
    private readonly minDelta = 2,
  ) {}

  update(now: number, value: number): boolean {
    if (this.lastValue !== null) {
      const delta = value - this.lastValue;
      if (Math.abs(delta) >= this.minDelta) {
        const sign = Math.sign(delta);
        if (this.lastSign !== 0 && sign !== this.lastSign) this.reversals.push(now);
        this.lastSign = sign;
        this.lastValue = value;
      }
    } else {
      this.lastValue = value;
    }
    const cutoff = now - this.windowMs;
    this.reversals = this.reversals.filter(t => t >= cutoff);
    return this.reversals.length >= this.needed;
  }

  reset() { this.reversals = []; this.lastSign = 0; this.lastValue = null; }
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export type ReminderKind = "stretch" | "water" | "note";
export type AgentEvent = "thinking" | "done" | "error";

/** Everything the engine is allowed to know. Derived from Activity + detectors. */
export interface Signals {
  dragging: boolean;
  /** Cursor is over the dog's head region and stroking back and forth. */
  petting: boolean;
  shaking: boolean;
  /** Sustained fast cursor — already debounced by SustainedDetector. */
  chasing: boolean;
  alert: boolean;
  scrolling: boolean;
  clicking: boolean;
  typingKps: number;
  idleMs: number;
  reminder: ReminderKind | null;
  agentEvent: AgentEvent | null;
  /** Set for one update after meaningful input arrives while asleep. */
  justWoke: boolean;
  /** Artwork actually present in the loaded atlas. Missing art must not crash. */
  availableFrames: ReadonlySet<string>;
  reducedMotion: boolean;
}

// ─── State table ──────────────────────────────────────────────────────────────

export type StateId =
  | "recover" | "drag" | "pet" | "reminder" | "agent" | "wake"
  | "click" | "typing_intense" | "typing" | "chase" | "alert" | "scroll"
  | "stretch" | "wander" | "idle" | "sleepy" | "asleep";

/** Plan §13.1 — every behaviour carries this full record. */
export interface StateDef {
  id: StateId;
  /** Plan §13.2, 1 = highest. */
  priority: number;
  entry?: string;
  loop: string;
  exit?: string;
  mode: Mode;
  minMs: number;
  maxMs?: number;
  cooldownMs: number;
  interruptible: boolean;
  sound?: string;
  /** Substituted for `loop` when the user has asked for reduced motion. */
  reducedMotion?: string;
  fallback: StateId;
  when: (s: Signals) => boolean;
}

/**
 * ORDER MATTERS. Ties in priority are broken by position in this array, so
 * anything sharing a priority with `idle` must appear above it — `idle`'s
 * predicate is always true and will shadow everything below it.
 */
export const STATES: readonly StateDef[] = [
  { id: "recover", priority: 1, loop: "idle", mode: "idle", minMs: 0, cooldownMs: 0,
    interruptible: true, fallback: "idle", when: () => false },

  { id: "drag", priority: 2, entry: "drag", loop: "drag", exit: "land", mode: "fast",
    minMs: 0, cooldownMs: 0, interruptible: true, fallback: "idle",
    when: s => s.dragging },

  { id: "pet", priority: 3, loop: "pet_happy", mode: "normal", minMs: 600, maxMs: 6000,
    cooldownMs: 400, interruptible: true, fallback: "idle",
    when: s => s.petting },

  { id: "reminder", priority: 4, entry: "bark", loop: "deliver_note", mode: "normal",
    minMs: 1200, maxMs: 12_000, cooldownMs: 30_000, interruptible: false,
    sound: "chime", reducedMotion: "sit_side", fallback: "idle",
    when: s => s.reminder !== null },

  { id: "agent", priority: 5, entry: "happy_jump", loop: "tail_wag", mode: "fast",
    minMs: 800, maxMs: 4000, cooldownMs: 2000, interruptible: true,
    sound: "bark", reducedMotion: "sit_happy", fallback: "idle",
    when: s => s.agentEvent !== null },

  { id: "wake", priority: 6, entry: "stretch", loop: "sit_happy", mode: "normal",
    minMs: 900, maxMs: 2500, cooldownMs: 5000, interruptible: false, fallback: "idle",
    when: s => s.justWoke },

  { id: "click", priority: 7, loop: "bark", mode: "normal", minMs: 250, maxMs: 900,
    cooldownMs: 700, interruptible: true, sound: "bark", reducedMotion: "sit_side",
    fallback: "idle", when: s => s.clicking },

  { id: "typing_intense", priority: 7, loop: "type_intense", mode: "normal",
    minMs: 400, cooldownMs: 0, interruptible: true, fallback: "idle",
    when: s => s.typingKps >= 8 },

  { id: "typing", priority: 7, loop: "type_paw", mode: "normal",
    minMs: 400, cooldownMs: 0, interruptible: true, fallback: "idle",
    when: s => s.typingKps >= 2 },

  { id: "chase", priority: 8, loop: "run", mode: "fast", minMs: 500, maxMs: 8000,
    cooldownMs: 1500, interruptible: true, reducedMotion: "sit_side", fallback: "idle",
    when: s => s.chasing },

  { id: "alert", priority: 8, loop: "walk_a", mode: "normal", minMs: 300,
    cooldownMs: 0, interruptible: true, reducedMotion: "sit_side", fallback: "idle",
    when: s => s.alert },

  { id: "scroll", priority: 9, loop: "paper_unroll", mode: "normal", minMs: 300,
    cooldownMs: 500, interruptible: true, reducedMotion: "sit_side", fallback: "idle",
    when: s => s.scrolling },

  { id: "stretch", priority: 10, loop: "stretch", mode: "normal", minMs: 1500,
    maxMs: 4000, cooldownMs: 120_000, interruptible: true, fallback: "idle",
    when: () => false },

  { id: "wander", priority: 11, loop: "walk_a", mode: "normal", minMs: 1500,
    maxMs: 6000, cooldownMs: 45_000, interruptible: true,
    reducedMotion: "sit_side", fallback: "idle", when: () => false },

  { id: "asleep", priority: 12, entry: "lie_down", loop: "sleep", exit: "wake",
    mode: "sleeping", minMs: 0, cooldownMs: 0, interruptible: true, fallback: "idle",
    when: s => s.idleMs > 600_000 },

  { id: "sleepy", priority: 12, loop: "sit_side", mode: "sleeping", minMs: 0,
    cooldownMs: 0, interruptible: true, fallback: "idle",
    when: s => s.idleMs > 300_000 },

  { id: "idle", priority: 12, loop: "idle", mode: "idle", minMs: 0, cooldownMs: 0,
    interruptible: true, fallback: "idle", when: () => true },
] as const;

const BY_ID = new Map(STATES.map(s => [s.id, s]));

/** Candidate order: priority first; Array.sort is stable, so table order breaks ties. */
const ORDERED = [...STATES].sort((a, b) => a.priority - b.priority);

export interface EngineOutput {
  state: StateId;
  frame: string;
  mode: Mode;
  /** True on the update where the state changed — for firing sounds once. */
  changed: boolean;
  sound?: string;
}

export class BehaviourEngine {
  private current: StateDef;
  private enteredAt: number;
  private lastExitAt = new Map<StateId, number>();
  private changed = true;

  constructor(now: number) {
    this.current = BY_ID.get("idle")!;
    this.enteredAt = now;
  }

  get state(): StateId { return this.current.id; }
  get since(): number { return this.enteredAt; }

  update(now: number, s: Signals): EngineOutput {
    const elapsed = now - this.enteredAt;
    this.changed = false;

    // Plan §13.4: maxMs guarantees every state has an exit even if its
    // trigger is stuck on. This is the anti-wedge rule.
    const expired = this.current.maxMs !== undefined && elapsed >= this.current.maxMs;

    if (expired) {
      this.enter(BY_ID.get(this.current.fallback)!, now);
    } else {
      const next = this.pick(now, s);
      if (next && next.id !== this.current.id) {
        // minMs protects a visible action from lower/equal-priority churn,
        // including non-interruptible actions. A strictly higher-priority
        // direct interaction must still preempt immediately: if the user is
        // physically holding the dog, drag can never wait behind a reminder.
        const holdMin = elapsed < this.current.minMs && next.priority >= this.current.priority;
        if (!holdMin) this.enter(next, now);
      }
    }

    return {
      state: this.current.id,
      frame: this.frameFor(this.current, s),
      mode: this.current.mode,
      changed: this.changed,
      sound: this.changed ? this.soundFor(s) : undefined,
    };
  }

  private pick(now: number, s: Signals): StateDef | null {
    for (const def of ORDERED) {
      if (!def.when(s)) continue;
      if (def.id !== this.current.id) {
        // Plan §13.4: no re-entering a state before its cooldown has elapsed.
        // Cooldown must not block *staying* in the state we are already in.
        const last = this.lastExitAt.get(def.id);
        if (def.cooldownMs > 0 && last !== undefined && now - last < def.cooldownMs) continue;
      }
      return def;
    }
    return null;
  }

  private enter(def: StateDef, now: number) {
    if (def.id === this.current.id) return;
    this.lastExitAt.set(this.current.id, now);
    this.current = def;
    this.enteredAt = now;
    this.changed = true;
  }

  /**
   * Plan §13.4: missing artwork degrades to idle rather than crashing, and a
   * reduced-motion user gets the calm alternative where one is defined.
   */
  private frameFor(def: StateDef, s: Signals): string {
    const reminderFrame =
      def.id === "reminder" && s.reminder === "water" ? "drink" :
      def.id === "reminder" && s.reminder === "stretch" ? "stretch" :
      def.id === "reminder" && s.reminder === "note" ? "deliver_note" :
      null;
    const agentFrame =
      def.id === "agent" && s.agentEvent === "thinking" ? "head_tilt" :
      def.id === "agent" && s.agentEvent === "error" ? "alert" :
      null;
    const wanted = reminderFrame
      ?? agentFrame
      ?? ((s.reducedMotion && def.reducedMotion) ? def.reducedMotion : def.loop);
    if (s.availableFrames.has(wanted)) return wanted;
    if (s.availableFrames.has(def.loop)) return def.loop;
    return s.availableFrames.has("idle") ? "idle" : [...s.availableFrames][0] ?? "idle";
  }

  private soundFor(s: Signals): string | undefined {
    if (this.current.id === "agent" && s.agentEvent === "thinking") return undefined;
    if (this.current.id === "agent" && s.agentEvent === "error") return "chime";
    return this.current.sound;
  }

  /** Watchdog — plan §13.4. Force any unknown or wedged state back to idle. */
  forceIdle(now: number) {
    this.enter(BY_ID.get("idle")!, now);
  }
}

export function stateById(id: StateId): StateDef | undefined {
  return BY_ID.get(id);
}
