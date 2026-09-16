import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { findLatestLogs, type LogFile } from './find-latest-log';

export interface IndexedSession {
  id: string;
  updatedAtMs: number;
}

/** Only the newest few sessions matter, and the index can grow. */
const MAX_SESSIONS_CONSIDERED = 5;

/**
 * `~/.codex/session_index.jsonl`: one `{ id, thread_name, updated_at }` per session, Codex's own record
 * of when each session last changed. It's the authoritative answer to "which session is current",
 * unlike file paths (a session keeps its original date folder forever) or modified times.
 */
export function parseSessionIndex(text: string): IndexedSession[] {
  const sessions: IndexedSession[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // truncated final line, or a format we don't know
    }
    const entry = parsed as { id?: unknown; updated_at?: unknown };
    if (typeof entry.id !== 'string' || typeof entry.updated_at !== 'string') continue;
    const updatedAtMs = Date.parse(entry.updated_at);
    if (Number.isNaN(updatedAtMs)) continue;
    sessions.push({ id: entry.id, updatedAtMs });
  }
  return sessions.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

/** The rollout file of the most recently updated indexed session, or null when the index can't point at one. */
export async function findIndexedLog(home: string): Promise<LogFile | null> {
  let text: string;
  try {
    text = await readFile(join(home, '.codex', 'session_index.jsonl'), 'utf8');
  } catch {
    return null;
  }

  const sessions = parseSessionIndex(text).slice(0, MAX_SESSIONS_CONSIDERED);
  if (sessions.length === 0) return null;

  // File names end with the session id, but the date folder is the session's start date, so scan every folder.
  const files = await findLatestLogs(join(home, '.codex', 'sessions'), undefined, Number.POSITIVE_INFINITY);
  for (const session of sessions) {
    const match = files.find((file) => file.path.endsWith(`-${session.id}.jsonl`));
    if (!match) continue;
    try {
      const fresh = await stat(match.path);
      return { path: match.path, mtimeMs: fresh.mtimeMs, size: fresh.size };
    } catch {
      continue; // deleted between listing and stat
    }
  }
  return null;
}
