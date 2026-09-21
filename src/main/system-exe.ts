import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

/**
 * Full path to a Windows system program. A bare name is looked up in the current directory before
 * PATH, so a look-alike exe dropped there would run instead (binary planting).
 */
export function systemExe(name: 'wsl.exe' | 'cmd.exe' | 'taskkill.exe', env: NodeJS.ProcessEnv = process.env): string {
  if (name === 'cmd.exe' && env.ComSpec) return env.ComSpec;
  return win32.join(env.SystemRoot ?? 'C:\\Windows', 'System32', name);
}

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * Finds a program on PATH the way cmd would (every PATHEXT extension, in PATH order), except that
 * the current directory and relative PATH entries are never searched. Null when it is not there.
 */
export function findOnPath(name: string, env: NodeJS.ProcessEnv = process.env, exists: (path: string) => boolean = existsSync): string | null {
  const dirs = (env.Path ?? env.PATH ?? '').split(';').map((dir) => dir.trim().replace(/^"(.*)"$/, '$1'));
  const exts = (env.PATHEXT ?? DEFAULT_PATHEXT).split(';').filter(Boolean);
  for (const dir of dirs) {
    if (!win32.isAbsolute(dir)) continue;
    for (const ext of exts) {
      const candidate = win32.join(dir, name + ext.toLowerCase());
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}
