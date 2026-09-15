import type { Snapshot } from '../shared/types';

export interface StoreEntry {
  latest: Snapshot;
  lastGood?: Snapshot;
  /** When the scheduler will run this provider next (shown as "retrying in …") */
  nextRunAt?: number;
}

export class UsageStore {
  private readonly entries = new Map<string, StoreEntry>();

  constructor(lastGood: Record<string, Snapshot> = {}) {
    for (const [id, snapshot] of Object.entries(lastGood)) {
      this.entries.set(id, { latest: snapshot, lastGood: snapshot });
    }
  }

  update(snapshot: Snapshot, nextRunAt?: number): { previous?: StoreEntry; entry: StoreEntry } {
    const previous = this.entries.get(snapshot.providerId);
    const entry: StoreEntry = {
      latest: snapshot,
      lastGood: snapshot.status === 'ok' ? snapshot : previous?.lastGood,
      ...(nextRunAt === undefined ? {} : { nextRunAt }),
    };
    this.entries.set(snapshot.providerId, entry);
    return { previous, entry };
  }

  get(providerId: string): StoreEntry | undefined {
    return this.entries.get(providerId);
  }

  lastGoodMap(): Record<string, Snapshot> {
    const map: Record<string, Snapshot> = {};
    for (const [id, entry] of this.entries) if (entry.lastGood) map[id] = entry.lastGood;
    return map;
  }
}
