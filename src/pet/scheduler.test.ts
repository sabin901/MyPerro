import { describe, it, expect } from "vitest";
import {
  makeRepeating, pollRepeating, pollMessages,
  startPomodoro, stopPomodoro, tickPomodoro, formatClock,
  pollScheduler, inQuietHours,
  type SchedulerState, type MessageReminder,
} from "./scheduler";

const MIN = 60_000;

describe("repeating reminders", () => {
  it("does not fire before the interval", () => {
    const r = makeRepeating("water", 30, 0);
    expect(pollRepeating(r, 29 * MIN)).toBe(false);
  });

  it("fires once the interval has passed", () => {
    const r = makeRepeating("water", 30, 0);
    expect(pollRepeating(r, 30 * MIN)).toBe(true);
  });

  it("does not fire twice for one interval", () => {
    const r = makeRepeating("water", 30, 0);
    expect(pollRepeating(r, 30 * MIN)).toBe(true);
    expect(pollRepeating(r, 31 * MIN)).toBe(false);
  });

  it("fires again after a second interval", () => {
    const r = makeRepeating("water", 30, 0);
    pollRepeating(r, 30 * MIN);
    expect(pollRepeating(r, 60 * MIN)).toBe(true);
  });

  it("collapses a long gap into ONE fire, not a burst (laptop woke from sleep)", () => {
    const r = makeRepeating("stretch", 20, 0);
    expect(pollRepeating(r, 180 * MIN)).toBe(true);   // 3h later, 9 intervals missed
    expect(pollRepeating(r, 181 * MIN)).toBe(false);
  });

  it("never fires when disabled", () => {
    const r = makeRepeating("water", 1, 0, false);
    expect(pollRepeating(r, 999 * MIN)).toBe(false);
  });

  it("treats a zero interval as off, not divide-by-zero", () => {
    const r = makeRepeating("water", 0, 0);
    expect(pollRepeating(r, MIN)).toBe(false);
  });
});

describe("message reminders", () => {
  const make = (id: string, at: number, text: string): MessageReminder =>
    ({ id, fireAt: at, text, fired: false });

  it("fires exactly once, at its time", () => {
    const list = [make("a", 100, "call mum")];
    expect(pollMessages(list, 99)).toEqual([]);
    expect(pollMessages(list, 100).map(m => m.text)).toEqual(["call mum"]);
    expect(pollMessages(list, 200)).toEqual([]);
  });

  it("returns every message that is due at once", () => {
    const list = [make("a", 100, "one"), make("b", 100, "two")];
    expect(pollMessages(list, 150).length).toBe(2);
  });
});

describe("pomodoro", () => {
  it("counts down during focus", () => {
    const p = startPomodoro(0);
    expect(tickPomodoro(p, 0).secondsRemaining).toBe(25 * 60);
    expect(tickPomodoro(p, 60_000).secondsRemaining).toBe(24 * 60);
  });

  it("focus → break at 25 minutes", () => {
    const p = startPomodoro(0);
    const t = tickPomodoro(p, 25 * MIN);
    expect(t.transitioned).toEqual({ from: "focus", to: "break" });
    expect(p.phase).toBe("break");
  });

  it("break → focus", () => {
    const p = startPomodoro(0);
    tickPomodoro(p, 25 * MIN);
    const t = tickPomodoro(p, 30 * MIN);
    expect(t.transitioned).toEqual({ from: "break", to: "focus" });
  });

  it("every 4th break is a long break", () => {
    const p = startPomodoro(0);
    let now = 0;
    const phases: string[] = [];
    for (let i = 0; i < 400; i++) {
      now += MIN;
      const t = tickPomodoro(p, now);
      if (t.transitioned) phases.push(t.transitioned.to);
    }
    expect(phases).toContain("long_break");
    const firstLong = phases.indexOf("long_break");
    const focusesBefore = phases.slice(0, firstLong).filter(x => x === "focus").length;
    expect(focusesBefore).toBe(3);
  });

  it("celebrates only when a focus round ends, never when a break ends", () => {
    const p = startPomodoro(0);
    expect(tickPomodoro(p, 25 * MIN).transitioned?.from).toBe("focus");
    expect(tickPomodoro(p, 30 * MIN).transitioned?.from).toBe("break");
  });

  it("does nothing when off", () => {
    const p = stopPomodoro(startPomodoro(0));
    expect(tickPomodoro(p, 999 * MIN).transitioned).toBeNull();
  });

  it("does not drift after many phases", () => {
    const p = startPomodoro(0);
    let now = 0;
    for (let i = 0; i < 1000; i++) { now += MIN; tickPomodoro(p, now); }
    expect(p.phaseStartedAt % MIN).toBe(0);
  });
});

describe("formatClock", () => {
  it("pads to mm:ss", () => {
    expect(formatClock(25 * 60)).toBe("25:00");
    expect(formatClock(59)).toBe("00:59");
    expect(formatClock(0)).toBe("00:00");
  });
  it("never goes negative", () => {
    expect(formatClock(-10)).toBe("00:00");
  });
});

describe("quiet hours", () => {
  it("is off when unset", () => {
    expect(inQuietHours(3, null, null)).toBe(false);
  });
  it("handles a same-day window", () => {
    expect(inQuietHours(13, 12, 14)).toBe(true);
    expect(inQuietHours(11, 12, 14)).toBe(false);
  });
  it("handles an overnight window (22:00–07:00)", () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(3, 22, 7)).toBe(true);
    expect(inQuietHours(12, 22, 7)).toBe(false);
  });
});

describe("pollScheduler — the one call the app makes", () => {
  const fresh = (now: number): SchedulerState => ({
    stretch: makeRepeating("stretch", 30, now),
    water: makeRepeating("water", 20, now),
    messages: [],
    pomodoro: stopPomodoro(startPomodoro(now)),
    quietFrom: null, quietTo: null,
  });

  it("fires nothing immediately", () => {
    expect(pollScheduler(fresh(0), 0, 12).reminder).toBeNull();
  });

  it("water (20m) fires before stretch (30m)", () => {
    expect(pollScheduler(fresh(0), 20 * MIN, 12).reminder).toBe("water");
  });

  it("a due message outranks a due recurring reminder", () => {
    const s = fresh(0);
    s.messages = [{ id: "x", fireAt: 20 * MIN, text: "standup", fired: false }];
    const out = pollScheduler(s, 20 * MIN, 12);
    expect(out.reminder).toBe("note");
    expect(out.message).toBe("standup");
  });

  it("suppresses nudges during quiet hours but still shows the clock", () => {
    const s = fresh(0);
    s.quietFrom = 0; s.quietTo = 8;
    s.pomodoro = startPomodoro(0);
    const out = pollScheduler(s, 25 * MIN, 3);
    expect(out.reminder).toBeNull();
    expect(out.clock).not.toBeNull();
  });

  it("forced quiet mode pauses a message without consuming it", () => {
    const s = fresh(0);
    s.messages = [{ id: "x", fireAt: 20 * MIN, text: "standup", fired: false }];
    expect(pollScheduler(s, 20 * MIN, 12, true).reminder).toBeNull();
    expect(s.messages[0].fired).toBe(false);
    expect(pollScheduler(s, 20 * MIN, 12, false).message).toBe("standup");
  });

  it("renders the pomodoro clock while running", () => {
    const s = fresh(0);
    s.pomodoro = startPomodoro(0);
    expect(pollScheduler(s, 60_000, 12).clock).toBe("24:00");
  });

  it("celebrates when a focus round completes", () => {
    const s = fresh(0);
    s.pomodoro = startPomodoro(0);
    expect(pollScheduler(s, 25 * MIN, 12).agentLikeCelebration).toBe(true);
  });
});
