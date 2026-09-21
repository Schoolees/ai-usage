import { describe, expect, it } from 'vitest';
import { findOnPath, systemExe } from './system-exe';

describe('systemExe', () => {
  it('resolves a system program under SystemRoot, never by bare name', () => {
    expect(systemExe('wsl.exe', { SystemRoot: 'D:\\Win' })).toBe('D:\\Win\\System32\\wsl.exe');
  });

  it('prefers ComSpec for cmd.exe', () => {
    expect(systemExe('cmd.exe', { ComSpec: 'C:\\Windows\\system32\\cmd.exe', SystemRoot: 'D:\\Win' })).toBe('C:\\Windows\\system32\\cmd.exe');
  });

  it('falls back to C:\\Windows when SystemRoot is unset', () => {
    expect(systemExe('cmd.exe', {})).toBe('C:\\Windows\\System32\\cmd.exe');
  });
});

describe('findOnPath', () => {
  const on = (...files: string[]) => (path: string) => files.includes(path);

  it('tries every PATHEXT extension in PATH order', () => {
    const env = { Path: 'C:\\a;C:\\b', PATHEXT: '.EXE;.CMD' };
    expect(findOnPath('codex', env, on('C:\\b\\codex.exe', 'C:\\a\\codex.cmd'))).toBe('C:\\a\\codex.cmd');
  });

  it('never searches the current directory or relative PATH entries', () => {
    const env = { Path: '.;bin;;C:\\tools', PATHEXT: '.EXE' };
    expect(findOnPath('codex', env, on('.\\codex.exe', 'bin\\codex.exe'))).toBeNull();
    expect(findOnPath('codex', env, on('C:\\tools\\codex.exe'))).toBe('C:\\tools\\codex.exe');
  });

  it('accepts quoted PATH entries and a missing PATHEXT', () => {
    expect(findOnPath('codex', { Path: '"C:\\Program Files\\n"' }, on('C:\\Program Files\\n\\codex.cmd'))).toBe('C:\\Program Files\\n\\codex.cmd');
  });
});
