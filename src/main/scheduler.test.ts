import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../shared/types';
import { Scheduler, nextDelayMs, type ScheduledTask } from './scheduler';

const snap = (status: Snapshot['status'], extra: Partial<Snapshot> = {}): Snapshot => ({
  providerId: 'claude',
  source: null,
  status,
  dataAsOf: Date.now(),
  limits: [],
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nextDelayMs', () => {
  it('uses the interval when healthy and backs off after errors', () => {
    expect(nextDelayMs(0, 120_000)).toBe(120_000);
    expect(nextDelayMs(1, 120_000)).toBe(60_000);
    expect(nextDelayMs(2, 120_000)).toBe(120_000);
    expect(nextDelayMs(3, 120_000)).toBe(300_000);
    expect(nextDelayMs(4, 120_000)).toBe(600_000);
    expect(nextDelayMs(9, 120_000)).toBe(600_000);
  });

  it('honors a longer Retry-After', () => {
    expect(nextDelayMs(1, 120_000, 900_000)).toBe(900_000);
    expect(nextDelayMs(4, 120_000, 1_000)).toBe(600_000);
  });
});

describe('Scheduler', () => {
  function task(run: () => Promise<Snapshot>, intervalMs = 120_000): ScheduledTask {
    return { id: 'claude', intervalMs: () => intervalMs, run };
  }

  it('runs immediately on start, then every interval', async () => {
    const run = vi.fn(async () => snap('ok'));
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler([task(run)], onSnapshot);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok' }), 120_000);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('backs off after consecutive errors and resets on success', async () => {
    const results = [snap('error'), snap('error'), snap('ok'), snap('ok')];
    const run = vi.fn(async () => results.shift()!);
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler([task(run)], onSnapshot);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.anything(), 60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.anything(), 60_000 + 120_000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok' }), 180_000 + 120_000);
    scheduler.stop();
  });

  it('turns a thrown error into an error snapshot', async () => {
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler(
      [task(async () => Promise.reject(new Error('boom')))],
      onSnapshot,
    );
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'claude', status: 'error', message: 'boom', limits: [] }),
      60_000,
    );
    scheduler.stop();
  });

  it('refreshNow re-runs only tasks older than the threshold', async () => {
    const run = vi.fn(async () => snap('ok'));
    const scheduler = new Scheduler([task(run)], vi.fn());
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(10_000);
    await scheduler.refreshNow({ olderThanMs: 30_000 });
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(25_000);
    await scheduler.refreshNow({ olderThanMs: 30_000 });
    expect(run).toHaveBeenCalledTimes(2);

    await scheduler.refreshNow();
    expect(run).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('stop cancels timers and ignores in-flight results', async () => {
    let resolve!: (s: Snapshot) => void;
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler([task(() => new Promise((r) => (resolve = r)))], onSnapshot);
    scheduler.start();
    scheduler.stop();
    resolve(snap('ok'));
    await vi.advanceTimersByTimeAsync(1_000_000);
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('setTasks replaces the task list', async () => {
    const first = vi.fn(async () => snap('ok'));
    const second = vi.fn(async () => snap('ok', { providerId: 'codex' }));
    const scheduler = new Scheduler([task(first)], vi.fn());
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.setTasks([{ id: 'codex', intervalMs: () => 30_000, run: second }]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(5); // t=0 (restart) + 4 × 30s
    scheduler.stop();
  });
});
