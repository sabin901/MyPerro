import { describe, expect, it, vi } from "vitest";
import { RuntimeScheduler } from "./runtimeScheduler";

describe("RuntimeScheduler", () => {
  it("runs due jobs once and skips missed interval replays", async () => {
    const run = vi.fn();
    const scheduler = new RuntimeScheduler([{ id: "health", everyMs: 1000, run }], 0);
    scheduler.tick(999);
    scheduler.tick(5_000);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.tick(5_500);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.tick(6_000);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never overlaps a slow asynchronous job", async () => {
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const scheduler = new RuntimeScheduler([{ id: "native", everyMs: 50, run }], 0);
    scheduler.tick(50);
    await Promise.resolve();
    scheduler.tick(500);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    scheduler.tick(550);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("respects delayed starts and runtime enablement", async () => {
    let enabled = false;
    const run = vi.fn();
    const scheduler = new RuntimeScheduler([{
      id: "update", everyMs: 1000, firstAfterMs: 200, enabled: () => enabled, run,
    }], 0);
    scheduler.tick(199);
    scheduler.tick(200);
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    enabled = true;
    scheduler.tick(1_200);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reports failures and exposes privacy-safe task statistics", async () => {
    const onError = vi.fn();
    const scheduler = new RuntimeScheduler([
      { id: "native", everyMs: 50, run: () => Promise.reject(new Error("offline")) },
    ], 0, onError);
    scheduler.tick(50);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith("native", expect.any(Error));
    expect(scheduler.snapshot()).toEqual([expect.objectContaining({
      id: "native", runs: 1, failures: 1, skippedWhileRunning: 0,
    })]);
  });

  it("counts skipped due runs without replaying them", async () => {
    let finish!: () => void;
    const scheduler = new RuntimeScheduler([
      { id: "slow", everyMs: 50, run: () => new Promise<void>(resolve => { finish = resolve; }) },
    ], 0);
    scheduler.tick(50);
    scheduler.tick(100);
    scheduler.tick(150);
    expect(scheduler.snapshot()[0].skippedWhileRunning).toBe(2);
    finish();
    await Promise.resolve();
  });
});
