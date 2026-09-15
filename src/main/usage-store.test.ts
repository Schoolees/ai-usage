import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../shared/types';
import { UsageStore } from './usage-store';

const ok = (dataAsOf: number): Snapshot => ({
  providerId: 'claude',
  source: null,
  status: 'ok',
  dataAsOf,
  limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent: dataAsOf, resetsAt: null }],
});
const failed: Snapshot = { providerId: 'claude', source: null, status: 'error', dataAsOf: 99, limits: [], message: 'offline' };

describe('UsageStore', () => {
  it('keeps the last ok snapshot when a later fetch fails', () => {
    const store = new UsageStore();
    store.update(ok(10));
    const { previous, entry } = store.update(failed, 5_000);
    expect(previous?.latest.dataAsOf).toBe(10);
    expect(entry).toEqual({ latest: failed, lastGood: ok(10), nextRunAt: 5_000 });
  });

  it('seeds entries from persisted last-good snapshots', () => {
    const store = new UsageStore({ claude: ok(7) });
    expect(store.get('claude')).toEqual({ latest: ok(7), lastGood: ok(7) });
    expect(store.lastGoodMap()).toEqual({ claude: ok(7) });
  });

  it('returns undefined for unknown providers', () => {
    expect(new UsageStore().get('codex')).toBeUndefined();
  });
});
