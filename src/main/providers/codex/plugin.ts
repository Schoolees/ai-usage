import { join } from 'node:path';
import { DAY, HOUR, MINUTE } from '../../../shared/time';
import type { DetectedSource, Snapshot, Source } from '../../../shared/types';
import type { ProviderPlugin } from '../types';
import { findLatestLogs, readTail, type LogFile } from './find-latest-log';
import { findIndexedLog } from './session-index';
import { codexSnapshot, findLastRateLimits, type CodexRateLimitRecord } from './parse';

function sessionsDir(home: string): string {
  return join(home, '.codex', 'sessions');
}

/** A log written this recently is being used right now. */
const FRESH_LOG_MS = 15 * MINUTE;
/** A record this much older than the log holding it means we parsed the wrong thing (format drift). */
const RECORD_LAG_MS = 6 * HOUR;

/** Codex's own index first, then newest-by-modified-time; a session keeps its start date's folder forever. */
async function candidateLogs(home: string): Promise<LogFile[]> {
  const scanned = await findLatestLogs(sessionsDir(home));
  const indexed = await findIndexedLog(home).catch(() => null);
  if (!indexed) return scanned;
  return [indexed, ...scanned.filter((log) => log.path !== indexed.path)];
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
        const [latest] = await findLatestLogs(sessionsDir(candidate.home), undefined, 1);
        if (latest) found.push({ ...candidate, lastModifiedMs: latest.mtimeMs });
      }
      return found;
    },

    async fetch(source, now) {
      const logs = await candidateLogs(source.home);
      if (logs.length === 0) return notFound(source, now, `No Codex logs in ${source.label}`);

      const key = `${logs[0].path}|${logs[0].mtimeMs}`;
      if (cache?.key === key) return codexSnapshot(cache.record, source, now);

      for (const log of logs) {
        try {
          const record = findLastRateLimits(await readTail(log));
          if (record) {
            // A live log whose newest usage record is hours older than the file means the format moved
            // on and we are reading the wrong records: say so rather than presenting stale numbers.
            if (now - log.mtimeMs < FRESH_LOG_MS && log.mtimeMs - record.timestampMs > RECORD_LAG_MS) {
              return {
                providerId: 'codex',
                source,
                status: 'error',
                dataAsOf: record.timestampMs,
                limits: [],
                message: "Couldn't read current usage from the newest Codex log",
              };
            }
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
