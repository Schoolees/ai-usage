import { win32 } from 'node:path';

/**
 * Full path to a Windows system program. A bare name is looked up in the current directory before
 * PATH, so a look-alike exe dropped there would run instead (binary planting).
 */
export function systemExe(name: 'wsl.exe' | 'cmd.exe', env: NodeJS.ProcessEnv = process.env): string {
  if (name === 'cmd.exe' && env.ComSpec) return env.ComSpec;
  return win32.join(env.SystemRoot ?? 'C:\\Windows', 'System32', name);
}
