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
