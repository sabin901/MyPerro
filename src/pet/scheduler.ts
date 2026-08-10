/**
 * Phase 4 — the scheduler.
 *
 * This is the clock behind every reminder: stretch breaks, water breaks,
 * one-off messages, and the Pomodoro focus/break loop. Like the engine, it is
 * pure: you hand it the current time and it tells you what (if anything) is due.
 * No timers live in here, so a whole day of reminders can be replayed in a
 * millisecond of test time.
 *
 * The idea is deliberately simple. Each recurring reminder just remembers when
 * it last fired. If `now` is at least one interval past that, it's due, and we
 * roll its clock forward. That's the whole trick.
 */

import type { ReminderKind } from "./engine";

// ─── Recurring reminders (stretch, water) ──────────────────────────────────────

export interface RepeatingReminder {
  kind: ReminderKind;
  enabled: boolean;
  /** How often it fires, in minutes. */
  everyMinutes: number;
  /** When it last fired (ms). Starts as the moment it was switched on. */
  lastFiredAt: number;
}

export function makeRepeating(
  kind: ReminderKind,
  everyMinutes: number,
  now: number,
  enabled = true,
): RepeatingReminder {
  return { kind, enabled, everyMinutes, lastFiredAt: now };
}

/** Is this reminder due? If so, advance its clock and return true. */
export function pollRepeating(r: RepeatingReminder, now: number): boolean {
  if (!r.enabled || r.everyMinutes <= 0) return false;
  const intervalMs = r.everyMinutes * 60_000;
  if (now - r.lastFiredAt < intervalMs) return false;

  // Snap forward to the most recent slot, so a laptop waking from sleep fires
  // once, not fifty times in a row for every interval it missed.
  const missed = Math.floor((now - r.lastFiredAt) / intervalMs);
  r.lastFiredAt += missed * intervalMs;
  return true;
}

// ─── One-off message reminders ─────────────────────────────────────────────────

export interface MessageReminder {
  id: string;
  /** When it should fire (ms). */
  fireAt: number;
  text: string;
  fired: boolean;
}

/** Returns any messages now due, and marks them fired so they don't repeat. */
export function pollMessages(list: MessageReminder[], now: number): MessageReminder[] {
  const due: MessageReminder[] = [];
  for (const m of list) {
    if (!m.fired && now >= m.fireAt) {
      m.fired = true;
      due.push(m);
    }
  }
  return due;
}

// ─── Pomodoro ──────────────────────────────────────────────────────────────────

export type PomodoroPhase = "focus" | "break" | "long_break" | "off";

export interface PomodoroConfig {
  focusMinutes: number;      // e.g. 25
  breakMinutes: number;      // e.g. 5
  longBreakMinutes: number;  // e.g. 15
  roundsBeforeLongBreak: number; // e.g. 4
}

export const DEFAULT_POMODORO: PomodoroConfig = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
};

export interface PomodoroState {
  phase: PomodoroPhase;
  /** When the current phase started (ms). */
  phaseStartedAt: number;
  /** How many focus rounds completed since the last long break. */
  completedFocusRounds: number;
  config: PomodoroConfig;
}

export function startPomodoro(now: number, config = DEFAULT_POMODORO): PomodoroState {
  return { phase: "focus", phaseStartedAt: now, completedFocusRounds: 0, config };
}

export function stopPomodoro(s: PomodoroState): PomodoroState {
  return { ...s, phase: "off" };
}

function phaseLengthMs(s: PomodoroState): number {
  const c = s.config;
  switch (s.phase) {
    case "focus":      return c.focusMinutes * 60_000;
    case "break":      return c.breakMinutes * 60_000;
    case "long_break": return c.longBreakMinutes * 60_000;
    case "off":        return Infinity;
  }
}

export interface PomodoroTick {
  /** Non-null when a phase just ended and a new one began. */
  transitioned: null | { from: PomodoroPhase; to: PomodoroPhase };
  /** Whole seconds left in the current phase, for the pixel clock. */
  secondsRemaining: number;
}

/**
 * Advance the Pomodoro clock. Focus → break → focus, and every Nth break is a
 * long one. Returns whether we just crossed a boundary (so the dog can react)
 * and how much time is left (so the clock can render).
 */
export function tickPomodoro(s: PomodoroState, now: number): PomodoroTick {
  if (s.phase === "off") return { transitioned: null, secondsRemaining: 0 };

  const elapsed = now - s.phaseStartedAt;
  const length = phaseLengthMs(s);

  if (elapsed < length) {
    return { transitioned: null, secondsRemaining: Math.ceil((length - elapsed) / 1000) };
  }

  // Phase finished — decide what comes next.
  const from = s.phase;
  let to: PomodoroPhase;

  if (from === "focus") {
    s.completedFocusRounds += 1;
    to = s.completedFocusRounds % s.config.roundsBeforeLongBreak === 0 ? "long_break" : "break";
  } else {
    to = "focus"; // both break kinds return to focus
  }

  s.phase = to;
  s.phaseStartedAt += length; // carry the exact boundary, don't drift

  return {
    transitioned: { from, to },
    secondsRemaining: Math.ceil(phaseLengthMs(s) / 1000),
  };
}

/** "24:59" style clock text for the pixel display. */
export function formatClock(secondsRemaining: number): string {
  const s = Math.max(0, secondsRemaining);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

// ─── Putting it together ───────────────────────────────────────────────────────

export interface SchedulerState {
  stretch: RepeatingReminder;
  water: RepeatingReminder;
  messages: MessageReminder[];
  pomodoro: PomodoroState;
  /** Quiet hours: no reminders fire between these wall-clock hours (0–23). */
  quietFrom: number | null;
  quietTo: number | null;
}

export interface SchedulerOutput {
  /** A reminder the engine should show, or null. Highest-priority one wins. */
  reminder: ReminderKind | null;
  /** Text to speak/show with it (message reminders carry their own text). */
  message: string | null;
  /** The dog should celebrate — a focus round just ended. */
  agentLikeCelebration: boolean;
  /** Pixel-clock text while a Pomodoro is running, else null. */
  clock: string | null;
}

/**
 * The one call the app makes each tick. Everything time-based flows through
 * here, so there's a single place to reason about "what is the dog told to do".
 */
export function pollScheduler(
  s: SchedulerState,
  now: number,
  wallClockHour: number,
  forceQuiet = false,
): SchedulerOutput {
  const out: SchedulerOutput = { reminder: null, message: null, agentLikeCelebration: false, clock: null };

  // Pomodoro clock renders even during quiet hours; it's ambient, not a nag.
  const tick = tickPomodoro(s.pomodoro, now);
  if (s.pomodoro.phase !== "off") out.clock = formatClock(tick.secondsRemaining);
  if (tick.transitioned) {
    // Finishing a focus round is worth a happy hop; starting one isn't.
    out.agentLikeCelebration = tick.transitioned.from === "focus";
  }

  if (forceQuiet || inQuietHours(wallClockHour, s.quietFrom, s.quietTo)) return out;

  // Priority: a specific one-off message beats a generic recurring nudge.
  const dueMessages = pollMessages(s.messages, now);
  if (dueMessages.length > 0) {
    out.reminder = "note";
    out.message = dueMessages[0].text;
    return out;
  }

  if (pollRepeating(s.water, now)) { out.reminder = "water"; return out; }
  if (pollRepeating(s.stretch, now)) { out.reminder = "stretch"; return out; }

  return out;
}

/** Handles the wrap-around case, e.g. quiet from 22:00 to 07:00. */
export function inQuietHours(hour: number, from: number | null, to: number | null): boolean {
  if (from === null || to === null) return false;
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}
