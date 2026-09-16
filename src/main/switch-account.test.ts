import { describe, expect, it } from 'vitest';
import type { Source } from '../shared/types';
import { loginCommand } from './switch-account';

const wsl: Source = { kind: 'wsl', label: 'WSL · Ubuntu-24.04', home: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\you' };
const windows: Source = { kind: 'windows', label: 'Windows', home: 'C:\\Users\\you' };

describe('loginCommand', () => {
  it('runs the CLI in a login shell in the right distro', () => {
    const command = loginCommand('claude', wsl);
    expect(command?.file).toBe('wsl.exe');
    expect(command?.args.slice(0, 5)).toEqual(['-d', 'Ubuntu-24.04', '--', 'bash', '-lc']);
    expect(command?.args[5]).toContain('claude auth login');
  });

  it('uses each provider\u2019s own sign-in command', () => {
    expect(loginCommand('codex', wsl)?.args[5]).toContain('codex login');
    expect(loginCommand('codex', windows)).toEqual({ file: 'cmd.exe', args: ['/k', 'codex login'] });
  });

  it('keeps the window up after the CLI exits, so a failure can be read', () => {
    expect(loginCommand('claude', wsl)?.args[5]).toMatch(/read -rp/);
    expect(loginCommand('claude', windows)?.args[0]).toBe('/k');
  });

  it('passes a distro name as one argument, spaces and all', () => {
    const spaced: Source = { ...wsl, home: '\\\\wsl.localhost\\My Distro\\home\\you' };
    expect(loginCommand('claude', spaced)?.args[1]).toBe('My Distro');
  });

  it('never signs anything out: logout is not part of the command', () => {
    // `claude auth logout` may clear the whole credentials file, MCP server tokens included.
    expect(loginCommand('claude', wsl)?.args[5]).not.toContain('logout');
    expect(loginCommand('codex', windows)?.args[1]).not.toContain('logout');
  });

  it('declines a provider it has no sign-in command for', () => {
    expect(loginCommand('gemini', wsl)).toBeNull();
  });

  it('declines a WSL source whose home names no distro', () => {
    expect(loginCommand('claude', { ...wsl, home: 'C:\\Users\\you' })).toBeNull();
  });
});
