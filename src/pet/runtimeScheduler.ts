export interface RuntimeTask {
  id: string;
  everyMs: number;
  run: () => void | Promise<void>;
  /** Defaults to everyMs, so boot does not stampede slow native commands. */
  firstAfterMs?: number;
  enabled?: () => boolean;
}

export interface RuntimeTaskStats {
  id: string;
  runs: number;
  skippedWhileRunning: number;
  failures: number;
  lastDurationMs: number;
}

export type RuntimeTaskErrorHandler = (taskId: string, error: unknown) => void;

interface ScheduledTask extends RuntimeTask {
  nextAt: number;
  running: boolean;
  stats: RuntimeTaskStats;
}

/**
 * One cooperative clock for native/webview maintenance. Slow asynchronous
 * commands never overlap themselves, and a delayed webview executes each job
 * once instead of replaying every missed interval after resume.
 */
export class RuntimeScheduler {
  private readonly tasks: ScheduledTask[];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    tasks: readonly RuntimeTask[],
    startedAt = performance.now(),
    private readonly onError?: RuntimeTaskErrorHandler,
  ) {
    this.tasks = tasks.map(task => ({
      ...task,
      everyMs: Math.max(1, task.everyMs),
      nextAt: startedAt + Math.max(0, task.firstAfterMs ?? task.everyMs),
      running: false,
      stats: { id: task.id, runs: 0, skippedWhileRunning: 0, failures: 0, lastDurationMs: 0 },
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
      if (now < task.nextAt) continue;
      if (task.running) {
        task.stats.skippedWhileRunning++;
        task.nextAt = now + task.everyMs;
        continue;
      }
      task.nextAt = now + task.everyMs;
      if (task.enabled && !task.enabled()) continue;
      task.running = true;
      task.stats.runs++;
      const startedAt = performance.now();
      const finish = () => {
        task.stats.lastDurationMs = Math.max(0, performance.now() - startedAt);
        task.running = false;
      };
      const fail = (error: unknown) => {
        task.stats.failures++;
        finish();
        this.onError?.(task.id, error);
      };
      try {
        const result = task.run();
        void Promise.resolve(result).then(
          finish,
          fail,
        );
      } catch (error) {
        fail(error);
      }
    }
  }

  snapshot(): RuntimeTaskStats[] {
    return this.tasks.map(task => ({ ...task.stats }));
  }
}
