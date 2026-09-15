// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../../shared/ipc';
import { DEFAULT_SETTINGS, type SettingsPatch } from '../../shared/settings-schema';
import { SettingsApp } from './SettingsApp';

function fakeApi(setSettings: Api['setSettings'] = async (patch: SettingsPatch) => ({ ...DEFAULT_SETTINGS, ...patch })) {
  return {
    getView: vi.fn(),
    onView: vi.fn(),
    refresh: vi.fn(),
    resizeIsland: vi.fn(),
    setExpanded: vi.fn(),
    onCollapse: vi.fn(),
    onExpand: vi.fn(),
    openUsagePage: vi.fn(),
    openSettings: vi.fn(),
    getSettings: vi.fn(async () => DEFAULT_SETTINGS),
    setSettings: vi.fn(setSettings),
    getProviders: vi.fn(async () => [
      { id: 'claude', name: 'Claude', sources: [{ kind: 'wsl' as const, label: 'WSL · Ubuntu', home: '\\\\wsl.localhost\\Ubuntu\\home\\me', lastModifiedMs: 2 }] },
      { id: 'codex', name: 'ChatGPT (Codex)', sources: [] },
    ]),
    getDisplays: vi.fn(async () => [
      { id: 1, label: 'Display 1', primary: true },
      { id: 2, label: 'Display 2', primary: false },
    ]),
  } satisfies Api;
}

async function renderSettings(api: Api) {
  render(<SettingsApp api={api} />);
  await act(async () => {});
}

describe('SettingsApp', () => {
  it('toggles a provider', async () => {
    const api = fakeApi();
    await renderSettings(api);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('ChatGPT (Codex)'));
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({
      providers: { ...DEFAULT_SETTINGS.providers, codex: { enabled: false, sourceHome: null } },
    });
  });

  it('picks a provider source', async () => {
    const api = fakeApi();
    await renderSettings(api);

    fireEvent.change(screen.getByLabelText('Claude source'), { target: { value: '\\\\wsl.localhost\\Ubuntu\\home\\me' } });
    expect(api.setSettings).toHaveBeenLastCalledWith({
      providers: { ...DEFAULT_SETTINGS.providers, claude: { enabled: true, sourceHome: '\\\\wsl.localhost\\Ubuntu\\home\\me' } },
    });
    expect(screen.getByText('Not found on Windows or running WSL distros.')).toBeTruthy();
  });

  it('saves display, toggles and minutes', async () => {
    const api = fakeApi();
    await renderSettings(api);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Display'), { target: { value: '2' } });
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ displayId: 2 });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Hide when a fullscreen app is in front'));
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ hideInFullscreen: false });

    const minutes = screen.getByLabelText('Check Claude every (minutes)');
    fireEvent.change(minutes, { target: { value: '5' } });
    await act(async () => {
      fireEvent.blur(minutes);
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ claudeRefreshMs: 300_000 });
  });

  it('shows the error when saving fails', async () => {
    const api = fakeApi(async () => {
      throw new Error('Warning threshold must be below the critical threshold');
    });
    await renderSettings(api);
    const warn = screen.getByLabelText('Warning at (%)');
    fireEvent.change(warn, { target: { value: '99' } });
    await act(async () => {
      fireEvent.blur(warn);
    });
    expect(screen.getByRole('alert').textContent).toContain('Warning threshold must be below the critical threshold');
  });
});
