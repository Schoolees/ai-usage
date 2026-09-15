import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { DetectedSource, Source } from '../../shared/types';

export const WSL_PROBE_TIMEOUT_MS = 3000;

export interface DetectDeps {
  platform: NodeJS.Platform;
  homedir(): string;
  listRunningDistros(): Promise<Buffer>;
  readdir(path: string): Promise<string[]>;
  timeoutMs?: number;
}

/** `wsl.exe -l --running -q` prints UTF-16LE; distro names never contain spaces, sentences do. */
export function parseWslList(output: Buffer): string[] {
  return output
    .toString('utf16le')
    .replace(/^\uFEFF/, '')
    .replace(/\0/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[\w.-]+$/.test(line));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function listCandidateHomes(deps: DetectDeps): Promise<Source[]> {
  const isWindows = deps.platform === 'win32';
  const sources: Source[] = [{ kind: 'windows', label: isWindows ? 'Windows' : 'Local', home: deps.homedir() }];
  if (!isWindows) return sources;

  const timeoutMs = deps.timeoutMs ?? WSL_PROBE_TIMEOUT_MS;
  // Only running distros: touching \\wsl.localhost\<distro> would boot a stopped one.
  const distros = parseWslList(await withTimeout(deps.listRunningDistros(), timeoutMs, Buffer.alloc(0)));
  for (const distro of distros) {
    const homeRoot = `\\\\wsl.localhost\\${distro}\\home`;
    const users = await withTimeout(deps.readdir(homeRoot), timeoutMs, [] as string[]);
    for (const user of users) {
      sources.push({ kind: 'wsl', label: `WSL · ${distro}`, home: `${homeRoot}\\${user}` });
    }
  }
  return sources;
}

const WSL_HOME_RE = /^\\\\wsl\.localhost\\([^\\]+)\\/;

/** Extracts the distro name from a `\\wsl.localhost\<distro>\...` home path, or null for a non-WSL home. */
export function distroFromHome(home: string): string | null {
  return WSL_HOME_RE.exec(home)?.[1] ?? null;
}

export interface RunningDistroCache {
  isRunning(distro: string): Promise<boolean>;
}

/**
 * Caches the set of running WSL distros so scheduled fetches never probe wsl.exe (and never
 * touch \\wsl.localhost\<distro>, which would boot a stopped distro) more than once per ttlMs.
 * A failing or hanging list() call is treated as "no running distros".
 */
export function createRunningDistroCache(
  list: () => Promise<Buffer>,
  ttlMs = 30_000,
  now: () => number = Date.now,
): RunningDistroCache {
  let running = new Set<string>();
  let fetchedAt = -Infinity;
  let pending: Promise<void> | null = null;

  async function refresh(): Promise<void> {
    const output = await withTimeout(list(), WSL_PROBE_TIMEOUT_MS, Buffer.alloc(0));
    running = new Set(parseWslList(output));
    fetchedAt = now();
  }

  return {
    async isRunning(distro: string): Promise<boolean> {
      if (now() - fetchedAt > ttlMs) {
        pending ??= refresh().finally(() => {
          pending = null;
        });
        await pending;
      }
      return running.has(distro);
    },
  };
}

export function pickSource(detected: DetectedSource[], preferredHome: string | null): DetectedSource | null {
  if (preferredHome) {
    const preferred = detected.find((source) => source.home === preferredHome);
    if (preferred) return preferred;
  }
  return detected.reduce<DetectedSource | null>(
    (best, source) => (best === null || source.lastModifiedMs > best.lastModifiedMs ? source : best),
    null,
  );
}

export function defaultDetectDeps(): DetectDeps {
  return {
    platform: process.platform,
    homedir,
    listRunningDistros: () =>
      new Promise((resolve, reject) => {
        execFile(
          'wsl.exe',
          ['-l', '--running', '-q'],
          { encoding: 'buffer', windowsHide: true, timeout: WSL_PROBE_TIMEOUT_MS, killSignal: 'SIGKILL' },
          (error, stdout) => (error ? reject(error) : resolve(stdout)),
        );
      }),
    readdir: (path) => readdir(path),
  };
}
