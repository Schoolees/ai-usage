import type { Snapshot } from '../shared/types';
import { readJson, writeJsonAtomic } from './json-file';

export interface PersistedState {
  /** Last ok snapshot per provider, so the panel has numbers at launch. Never contains tokens. */
  lastGood: Record<string, Snapshot>;
  alertsFired: string[];
  /** The version that last ran, so a restart into a new version can say it was updated. */
  lastVersion: string | null;
}

const EMPTY: PersistedState = { lastGood: {}, alertsFired: [], lastVersion: null };

export function loadState(file: string): PersistedState {
  let raw: unknown;
  try {
    raw = readJson(file);
  } catch {
    return { ...EMPTY };
  }
  const state = (raw ?? {}) as { lastGood?: unknown; alertsFired?: unknown; lastVersion?: unknown };
  return {
    lastGood:
      state.lastGood && typeof state.lastGood === 'object' && !Array.isArray(state.lastGood)
        ? (state.lastGood as Record<string, Snapshot>)
        : {},
    alertsFired: Array.isArray(state.alertsFired) ? state.alertsFired.filter((k): k is string => typeof k === 'string') : [],
    lastVersion: typeof state.lastVersion === 'string' ? state.lastVersion : null,
  };
}

export function saveState(file: string, state: PersistedState): void {
  writeJsonAtomic(file, state);
}
