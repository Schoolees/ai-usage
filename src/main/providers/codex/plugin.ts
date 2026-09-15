import { join } from 'node:path';
import { DAY } from '../../../shared/time';
import type { DetectedSource, Snapshot, Source } from '../../../shared/types';
import type { ProviderPlugin } from '../types';
import { findLatestLogs, readTail } from './find-latest-log';
import { codexSnapshot, findLastRateLimits, type CodexRateLimitRecord } from './parse';

function sessionsDir(home: string): string {
  return join(home, '.codex', 'sessions');
}

export function createCodexPlugin(): ProviderPlugin {
  // Logs only change while Codex runs, so re-parse only when the newest log's path or mtime changes.
  let cache: { key: string; record: CodexRateLimitRecord } | null = null;

  const notFound = (source: Source, now: number, message: string): Snapshot => ({
    providerId: 'codex',
    source,
    status: 'not-found',
    dataAsOf: now,
    limits: [],
    message,
  });

  return {
    id: 'codex',
    name: 'ChatGPT (Codex)',
    shortName: 'Codex',
    usageUrl: 'https://chatgpt.com/codex/settings/usage',
    fromLogs: true,
    staleAfterMs: DAY,
    notFoundMessage: 'No Codex logs found on Windows or running WSL distros',
    intervalMs: () => 30_000,

    async detectSources(candidates) {
      const found: DetectedSource[] = [];
      for (const candidate of candidates) {
        const [latest] = await findLatestLogs(sessionsDir(candidate.home), 14, 1);
        if (latest) found.push({ ...candidate, lastModifiedMs: latest.mtimeMs });
      }
      return found;
    },

    async fetch(source, now) {
      const logs = await findLatestLogs(sessionsDir(source.home));
      if (logs.length === 0) return notFound(source, now, `No Codex logs in ${source.label}`);

      const key = `${logs[0].path}|${logs[0].mtimeMs}`;
      if (cache?.key === key) return codexSnapshot(cache.record, source, now);

      for (const log of logs) {
        try {
          const record = findLastRateLimits(await readTail(log));
          if (record) {
            cache = { key, record };
            return codexSnapshot(record, source, now);
          }
        } catch {
          // Log was deleted or became unreadable; try the next one.
          continue;
        }
      }
      return notFound(source, now, `No Codex usage recorded yet in ${source.label}`);
    },
  };
}
