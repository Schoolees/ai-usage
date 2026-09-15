import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface LogFile {
  path: string;
  mtimeMs: number;
  size: number;
}

async function numericDirsDesc(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => Number(b) - Number(a));
  } catch {
    return [];
  }
}

/** Newest `rollout-*.jsonl` files under <sessionsDir>/YYYY/MM/DD, looking at the last `maxDayDirs` day folders. */
export async function findLatestLogs(sessionsDir: string, maxDayDirs = 14, maxFiles = 5): Promise<LogFile[]> {
  const dayDirs: string[] = [];
  outer: for (const year of await numericDirsDesc(sessionsDir)) {
    for (const month of await numericDirsDesc(join(sessionsDir, year))) {
      for (const day of await numericDirsDesc(join(sessionsDir, year, month))) {
        dayDirs.push(join(sessionsDir, year, month, day));
        if (dayDirs.length >= maxDayDirs) break outer;
      }
    }
  }

  const files: LogFile[] = [];
  for (const dir of dayDirs) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.startsWith('rollout-') || !name.endsWith('.jsonl')) continue;
      const path = join(dir, name);
      try {
        const s = await stat(path);
        files.push({ path, mtimeMs: s.mtimeMs, size: s.size });
      } catch {
        // deleted between readdir and stat
      }
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, maxFiles);
}

const DEFAULT_TAIL_BYTES = 1024 * 1024;

export async function readTail(file: LogFile, maxBytes = DEFAULT_TAIL_BYTES): Promise<string> {
  const handle = await open(file.path, 'r');
  try {
    const length = Math.min(file.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, file.size - length);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}
