import { describe, expect, it } from 'vitest';
import { systemExe } from './system-exe';

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
