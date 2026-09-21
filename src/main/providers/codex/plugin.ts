import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { DAY, HOUR, MINUTE } from '../../../shared/time';
import type { DetectedSource, Snapshot, Source } from '../../../shared/types';
import type { ProviderPlugin } from '../types';
import { findLatestLogs, readTail, type LogFile } from './find-latest-log';
import { findIndexedLog } from './session-index';
import { codexSnapshot, findLastRateLimits, newestTokenCountMs, type CodexRateLimitRecord } from './parse';
import { readAppServerRateLimits } from './app-server';

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

export interface CodexPluginDeps {
  appServerRead?: (source: Source, now: number) => Promise<CodexRateLimitRecord>;
}

export function createCodexPlugin(deps: CodexPluginDeps = {}): ProviderPlugin {
  // Logs only change while Codex runs, so re-parse only when a candidate log's path, mtime, or size
  // changes. Include every candidate because the newest log may not have usage yet and the parser
  // may be serving a fallback log. Some filesystems coarsen mtime updates, while Codex appends
  // usage records immediately.
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
    // Keep this true because the fallback remains available when app-server is unavailable.
    fromLogs: true,
    staleAfterMs: DAY,
    notFoundMessage: 'No Codex logs found on Windows or running WSL distros',
    intervalMs: () => 30_000,

    async detectSources(candidates) {
      const found: DetectedSource[] = [];
      for (const candidate of candidates) {
        const [latest] = await findLatestLogs(sessionsDir(candidate.home), undefined, 1);
        if (latest) {
          found.push({ ...candidate, lastModifiedMs: latest.mtimeMs });
          continue;
        }
        try {
          found.push({ ...candidate, lastModifiedMs: (await stat(join(candidate.home, '.codex', 'auth.json'))).mtimeMs });
        } catch {
          // No Codex logs or authenticated app-server state in this home.
        }
      }
      return found;
    },

    async fetch(source, now) {
      try {
        const record = await (deps.appServerRead ?? readAppServerRateLimits)(source, now);
        return codexSnapshot(record, source, now);
      } catch {
        // Older Codex versions, API-key-only setups, and broken app-server launches can still be
        // served by the log reader below.
      }
      const logs = await candidateLogs(source.home);
      if (logs.length === 0) return notFound(source, now, `No Codex logs in ${source.label}`);

      const key = logs.map((log) => `${log.path}|${log.mtimeMs}|${log.size}`).join('|');
      if (cache?.key === key) return codexSnapshot(cache.record, source, now);

      for (const log of logs) {
        try {
          const tail = await readTail(log);
          const record = findLastRateLimits(tail);
          if (record) {
            // Codex recording usage right now that we cannot read, hours after the last record we
            // could, means the format moved on: say so rather than present stale numbers as current.
            // The file's own mtime is no evidence of that: reopening an old thread writes context
            // records immediately, and usage only follows with the model's first reply.
            const accountedAt = newestTokenCountMs(tail);
            if (accountedAt !== null && now - accountedAt < FRESH_LOG_MS && accountedAt - record.timestampMs > RECORD_LAG_MS) {
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
