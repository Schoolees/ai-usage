import { describe, expect, it, vi } from 'vitest';
import type { DetectedSource } from '../../shared/types';
import {
  createRunningDistroCache,
  distroFromHome,
  listCandidateHomes,
  parseWslList,
  pickSource,
  WSL_PROBE_TIMEOUT_MS,
  type DetectDeps,
} from './detect';

const utf16 = (text: string) => Buffer.from(`\uFEFF${text}`, 'utf16le');

function deps(overrides: Partial<DetectDeps>): DetectDeps {
  return {
    platform: 'win32',
    homedir: () => 'C:\\Users\\you',
    listRunningDistros: async () => utf16('Ubuntu\r\nDebian\r\n'),
    readdir: async (path) => (path.includes('Ubuntu') ? ['you'] : ['root2', 'dev']),
    timeoutMs: 50,
    ...overrides,
  };
}

describe('constants', () => {
  it('WSL_PROBE_TIMEOUT_MS is 3000', () => {
    expect(WSL_PROBE_TIMEOUT_MS).toBe(3000);
  });
});

describe('parseWslList', () => {
  it('decodes UTF-16LE output and drops the BOM and blank lines', () => {
    expect(parseWslList(utf16('Ubuntu\r\n\r\nDebian-12\r\n'))).toEqual(['Ubuntu', 'Debian-12']);
  });

  it('ignores the "no running distributions" sentence', () => {
    expect(parseWslList(utf16('There are no running distributions.\r\n'))).toEqual([]);
  });
});

describe('listCandidateHomes', () => {
  it('lists the Windows home and every user home in running distros', async () => {
    expect(await listCandidateHomes(deps({}))).toEqual([
      { kind: 'windows', label: 'Windows', home: 'C:\\Users\\you' },
      { kind: 'wsl', label: 'WSL · Ubuntu', home: '\\\\wsl.localhost\\Ubuntu\\home\\you' },
      { kind: 'wsl', label: 'WSL · Debian', home: '\\\\wsl.localhost\\Debian\\home\\root2' },
      { kind: 'wsl', label: 'WSL · Debian', home: '\\\\wsl.localhost\\Debian\\home\\dev' },
    ]);
  });

  it('only returns the local home on non-Windows platforms', async () => {
    expect(await listCandidateHomes(deps({ platform: 'linux', homedir: () => '/home/me' }))).toEqual([
      { kind: 'windows', label: 'Local', home: '/home/me' },
    ]);
  });

  it('survives wsl.exe failing or hanging', async () => {
    const failing = await listCandidateHomes(deps({ listRunningDistros: async () => Promise.reject(new Error('no wsl')) }));
    expect(failing).toHaveLength(1);
    const hanging = await listCandidateHomes(deps({ listRunningDistros: () => new Promise(() => {}) }));
    expect(hanging).toHaveLength(1);
  });

  it('skips a distro whose home folder cannot be read in time', async () => {
    const result = await listCandidateHomes(
      deps({ readdir: (path) => (path.includes('Ubuntu') ? new Promise(() => {}) : Promise.resolve(['dev'])) }),
    );
    expect(result.map((s) => s.home)).toEqual(['C:\\Users\\you', '\\\\wsl.localhost\\Debian\\home\\dev']);
  });
});

describe('distroFromHome', () => {
  it('extracts the distro name from a wsl.localhost home path', () => {
    expect(distroFromHome('\\\\wsl.localhost\\Ubuntu\\home\\me')).toBe('Ubuntu');
    expect(distroFromHome('\\\\wsl.localhost\\Debian-12\\home\\dev')).toBe('Debian-12');
  });

  it('returns null for a non-WSL home', () => {
    expect(distroFromHome('C:\\Users\\you')).toBeNull();
    expect(distroFromHome('/home/me')).toBeNull();
  });
});

describe('createRunningDistroCache', () => {
  it('calls list only once within the TTL, and again once the TTL elapses', async () => {
    const list = vi.fn(async () => utf16('Ubuntu\r\n'));
    let now = 0;
    const cache = createRunningDistroCache(list, 30_000, () => now);

    expect(await cache.isRunning('Ubuntu')).toBe(true);
    expect(await cache.isRunning('Ubuntu')).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);

    now = 29_999;
    expect(await cache.isRunning('Ubuntu')).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);

    now = 30_001;
    expect(await cache.isRunning('Ubuntu')).toBe(true);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('reports nothing running when the list call fails', async () => {
    const cache = createRunningDistroCache(async () => Promise.reject(new Error('no wsl')));
    expect(await cache.isRunning('Ubuntu')).toBe(false);
  });

  it('reports nothing running when the list call hangs past the probe timeout', async () => {
    const cache = createRunningDistroCache(() => new Promise(() => {}));
    expect(await cache.isRunning('Ubuntu')).toBe(false);
  }, WSL_PROBE_TIMEOUT_MS + 1000);
});

describe('pickSource', () => {
  const windows: DetectedSource = { kind: 'windows', label: 'Windows', home: 'C:\\Users\\you', lastModifiedMs: 100 };
  const wsl: DetectedSource = { kind: 'wsl', label: 'WSL · Ubuntu', home: '\\\\wsl.localhost\\Ubuntu\\home\\you', lastModifiedMs: 200 };

  it('prefers the configured home when it is still detected', () => {
    expect(pickSource([windows, wsl], windows.home)).toBe(windows);
  });

  it('falls back to the most recently modified source', () => {
    expect(pickSource([windows, wsl], null)).toBe(wsl);
    expect(pickSource([windows, wsl], 'D:\\gone')).toBe(wsl);
  });

  it('returns null when nothing is detected', () => {
    expect(pickSource([], null)).toBeNull();
  });
});
