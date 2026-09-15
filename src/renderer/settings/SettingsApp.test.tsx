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
    setInteractive: vi.fn(),
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
    getTheme: vi.fn(),
    onTheme: vi.fn(),
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

  it('renders on/off options as switches that reflect the saved value', async () => {
    const api = fakeApi();
    await renderSettings(api);

    const codex = screen.getByRole('switch', { name: 'ChatGPT (Codex)' });
    expect(codex.getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      fireEvent.click(codex);
    });
    expect(screen.getByRole('switch', { name: 'ChatGPT (Codex)' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Start with Windows' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Show notifications' })).toBeTruthy();
  });

  it('shows the unit next to number fields and a sidebar entry per section', async () => {
    const api = fakeApi();
    await renderSettings(api);

    expect(screen.getByLabelText('Warning at').parentElement?.textContent).toContain('%');
    expect(screen.getByLabelText('Check Claude every').parentElement?.textContent).toContain('min');
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Providers', 'Island', 'Alerts', 'Refresh']);
  });

  it('picks a provider source', async () => {
    const api = fakeApi();
    await renderSettings(api);

    fireEvent.click(screen.getByRole('button', { name: 'Claude source' }));
    fireEvent.click(screen.getByRole('option', { name: /WSL · Ubuntu/ }));
    expect(api.setSettings).toHaveBeenLastCalledWith({
      providers: { ...DEFAULT_SETTINGS.providers, claude: { enabled: true, sourceHome: '\\\\wsl.localhost\\Ubuntu\\home\\me' } },
    });
    expect(screen.getByText('Not found on Windows or running WSL distros.')).toBeTruthy();
  });

  it('saves display, toggles and minutes', async () => {
    const api = fakeApi();
    await renderSettings(api);

    fireEvent.click(screen.getByRole('button', { name: 'Display' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /Display 2/ }));
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ displayId: 2 });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Hide when a fullscreen app is in front'));
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ hideInFullscreen: false });

    const minutes = screen.getByLabelText('Check Claude every');
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
    const warn = screen.getByLabelText('Warning at');
    fireEvent.change(warn, { target: { value: '99' } });
    await act(async () => {
      fireEvent.blur(warn);
    });
    expect(screen.getByRole('alert').textContent).toContain('Warning threshold must be below the critical threshold');
  });

  it("extracts the zod issue message from Electron's raw IPC error text, and re-fetches settings", async () => {
    const api = fakeApi(async () => {
      throw new Error(
        "Error invoking remote method 'settings:set': ZodError: [{\"message\":\"Warning threshold must be below the critical threshold\"}]",
      );
    });
    await renderSettings(api);
    const warn = screen.getByLabelText('Warning at');
    fireEvent.change(warn, { target: { value: '99' } });
    await act(async () => {
      fireEvent.blur(warn);
    });
    expect(screen.getByRole('alert').textContent).toContain('Warning threshold must be below the critical threshold');
    expect(screen.getByRole('alert').textContent).not.toContain('ZodError');
    expect(api.getSettings).toHaveBeenCalledTimes(2);
  });
});
