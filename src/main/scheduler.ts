import type { Snapshot } from '../shared/types';

export const RETRY_STEPS_MS = [60_000, 120_000, 300_000, 600_000] as const;

export function nextDelayMs(consecutiveErrors: number, intervalMs: number, retryAfterMs?: number): number {
  const base =
    consecutiveErrors === 0
      ? intervalMs
      : RETRY_STEPS_MS[Math.min(consecutiveErrors, RETRY_STEPS_MS.length) - 1];
  return Math.max(base, retryAfterMs ?? 0);
}

export interface ScheduledTask {
  id: string;
  intervalMs(): number;
  run(): Promise<Snapshot>;
}

interface TaskState {
  errors: number;
  running: boolean;
  lastRunAt?: number;
  timer?: ReturnType<typeof setTimeout>;
}

export class Scheduler {
  private states = new Map<string, TaskState>();
  /** Bumped by stop(); results from an older generation are dropped. */
  private generation = 0;
  private active = false;

  constructor(
    private tasks: ScheduledTask[],
    private readonly onSnapshot: (snapshot: Snapshot, nextRunAt: number) => void,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    this.active = true;
    for (const task of this.tasks) void this.run(task);
  }

  stop(): void {
    this.active = false;
    this.generation++;
    for (const state of this.states.values()) if (state.timer) clearTimeout(state.timer);
    this.states.clear();
  }

  setTasks(tasks: ScheduledTask[]): void {
    this.stop();
    this.tasks = tasks;
    this.start();
  }

  async refreshNow(options: { olderThanMs?: number } = {}): Promise<void> {
    const now = this.now();
    const due = this.tasks.filter((task) => {
      const lastRunAt = this.states.get(task.id)?.lastRunAt;
      return options.olderThanMs === undefined || lastRunAt === undefined || now - lastRunAt > options.olderThanMs;
    });
    await Promise.all(due.map((task) => this.run(task)));
  }

  private async run(task: ScheduledTask): Promise<void> {
    if (!this.active) return;
    const generation = this.generation;
    const state = this.states.get(task.id) ?? { errors: 0, running: false };
    this.states.set(task.id, state);
    if (state.running) return;
    if (state.timer) clearTimeout(state.timer);
    state.running = true;

    let snapshot: Snapshot;
    try {
      snapshot = await task.run();
    } catch (error) {
      snapshot = {
        providerId: task.id,
        source: null,
        status: 'error',
        dataAsOf: this.now(),
        limits: [],
        message: error instanceof Error ? error.message : String(error),
      };
    }

    if (generation !== this.generation) return;
    state.running = false;
    state.lastRunAt = this.now();
    state.errors = snapshot.status === 'error' ? state.errors + 1 : 0;
    const delay = nextDelayMs(state.errors, task.intervalMs(), snapshot.retryAfterMs);
    state.timer = setTimeout(() => void this.run(task), delay);
    this.onSnapshot(snapshot, state.lastRunAt + delay);
  }
}
