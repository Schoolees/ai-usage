// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../../shared/ipc';
import type { IslandView, ProviderView } from '../../shared/view-model';
import { IslandApp } from './IslandApp';

import { claude, codex, now } from './test-fixtures';

function fakeApi(view: IslandView) {
  const listeners = { view: [] as ((v: IslandView) => void)[], collapse: [] as (() => void)[], expand: [] as (() => void)[] };
  const api: Api = {
    getView: vi.fn(async () => view),
    onView: (l) => (listeners.view.push(l), () => {}),
    refresh: vi.fn(async () => {}),
    resizeIsland: vi.fn(),
    setExpanded: vi.fn(),
    onCollapse: (l) => (listeners.collapse.push(l), () => {}),
    onExpand: (l) => (listeners.expand.push(l), () => {}),
    openUsagePage: vi.fn(),
    openSettings: vi.fn(),
    getSettings: vi.fn(),
    setSettings: vi.fn(),
    getProviders: vi.fn(),
    getDisplays: vi.fn(),
  };
  return { api, listeners };
}

describe('IslandApp', () => {
  it('expands on click, refreshes stale data and collapses on Escape', async () => {
    const { api } = fakeApi({ providers: [claude, codex], generatedAt: now });
    render(<IslandApp api={api} clock={() => now} />);
    await act(async () => {});

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /usage details/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(api.setExpanded).toHaveBeenLastCalledWith(true);
    expect(api.refresh).toHaveBeenCalledWith(30_000);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.setExpanded).toHaveBeenLastCalledWith(false);
  });

  it('collapses when the main process reports blur and expands on request', async () => {
    const { api, listeners } = fakeApi({ providers: [claude], generatedAt: now });
    render(<IslandApp api={api} clock={() => now} />);
    await act(async () => {});

    act(() => listeners.expand.forEach((l) => l()));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => listeners.collapse.forEach((l) => l()));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-renders when a new view is pushed', async () => {
    const { api, listeners } = fakeApi({ providers: [claude], generatedAt: now });
    render(<IslandApp api={api} clock={() => now} />);
    await act(async () => {});
    const updated: ProviderView = { ...claude, maxPercent: 88, level: 'warn' };
    act(() => listeners.view.forEach((l) => l({ providers: [updated], generatedAt: now + 1 })));
    expect(screen.getByTestId('pill-claude').textContent).toBe('Claude 88%');
  });
});
