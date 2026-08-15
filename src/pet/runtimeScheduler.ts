export interface RuntimeTask {
  id: string;
  everyMs: number;
  run: () => void | Promise<void>;
  /** Defaults to everyMs, so boot does not stampede slow native commands. */
  firstAfterMs?: number;
  enabled?: () => boolean;
}

interface ScheduledTask extends RuntimeTask {
  nextAt: number;
  running: boolean;
}

/**
 * One cooperative clock for native/webview maintenance. Slow asynchronous
 * commands never overlap themselves, and a delayed webview executes each job
 * once instead of replaying every missed interval after resume.
 */
export class RuntimeScheduler {
  private readonly tasks: ScheduledTask[];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(tasks: readonly RuntimeTask[], startedAt = performance.now()) {
    this.tasks = tasks.map(task => ({
      ...task,
      everyMs: Math.max(1, task.everyMs),
      nextAt: startedAt + Math.max(0, task.firstAfterMs ?? task.everyMs),
      running: false,
    }));
  }

  start(pulseMs = 50): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(performance.now()), Math.max(16, pulseMs));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(now: number): void {
    for (const task of this.tasks) {
      if (now < task.nextAt || task.running) continue;
      task.nextAt = now + task.everyMs;
      if (task.enabled && !task.enabled()) continue;
      task.running = true;
      try {
        const result = task.run();
        void Promise.resolve(result).then(
          () => { task.running = false; },
          () => { task.running = false; }, // task owners log actionable native failures
        );
      } catch {
        task.running = false;
      }
    }
  }
}
