// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    setInteractive: vi.fn(),
    onCollapse: (l) => (listeners.collapse.push(l), () => {}),
    onExpand: (l) => (listeners.expand.push(l), () => {}),
    openUsagePage: vi.fn(),
    openSettings: vi.fn(),
    getSettings: vi.fn(),
    setSettings: vi.fn(),
    getProviders: vi.fn(),
    getDisplays: vi.fn(),
    getAppInfo: vi.fn(),
    getTheme: vi.fn(),
    onTheme: vi.fn(),
  };
  return { api, listeners };
}

async function renderIsland(view: IslandView) {
  const { api, listeners } = fakeApi(view);
  const { container } = render(<IslandApp api={api} clock={() => now} />);
  await act(async () => {});
  const island = () => container.querySelector('.island')!;
  const pill = () => screen.getByRole('button', { name: /usage details/i });
  return { api, listeners, island, pill };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('IslandApp', () => {
  it('expands after hovering the pill briefly and collapses after the pointer leaves', async () => {
    const { api, island, pill } = await renderIsland({ providers: [claude, codex], generatedAt: now });

    expect(island().className).toBe('island');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.mouseEnter(pill());
    expect(api.setInteractive).toHaveBeenLastCalledWith(true);
    expect(island().className).toBe('island'); // not instantly: a brush past the pill doesn't open it
    advance(120);
    expect(island().className).toBe('island expanded');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(api.setExpanded).toHaveBeenLastCalledWith(true);
    expect(api.refresh).toHaveBeenCalledWith(30_000);

    fireEvent.mouseLeave(pill());
    expect(api.setInteractive).toHaveBeenLastCalledWith(false);
    advance(100);
    expect(island().className).toBe('island expanded'); // grace period
    advance(300);
    expect(island().className).toBe('island');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.setExpanded).toHaveBeenLastCalledWith(false);
  });

  it('does not open when the pointer only brushes past the pill', async () => {
    const { island, pill } = await renderIsland({ providers: [claude], generatedAt: now });
    fireEvent.mouseEnter(pill());
    advance(40);
    fireEvent.mouseLeave(pill());
    advance(1000);
    expect(island().className).toBe('island');
  });

  it('stays open while the pointer moves from the pill into the panel', async () => {
    const { island, pill } = await renderIsland({ providers: [claude], generatedAt: now });
    fireEvent.mouseEnter(pill());
    advance(120);
    fireEvent.mouseLeave(pill());
    advance(60);
    fireEvent.mouseEnter(screen.getByRole('dialog'));
    advance(1000);
    expect(island().className).toBe('island expanded');
  });

  it('does not expand on click', async () => {
    const { island, pill } = await renderIsland({ providers: [claude], generatedAt: now });
    fireEvent.click(pill());
    advance(1000);
    expect(island().className).toBe('island');
  });

  it('keeps the panel mounted but hidden from assistive tech while collapsed', async () => {
    const { island } = await renderIsland({ providers: [claude], generatedAt: now });
    const panel = island().querySelector('.panel')!;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('collapses immediately when the main process reports the cursor left the window', async () => {
    const { listeners, island, pill } = await renderIsland({ providers: [claude], generatedAt: now });
    fireEvent.mouseEnter(pill());
    advance(120);
    act(() => listeners.collapse.forEach((l) => l()));
    expect(island().className).toBe('island');
  });

  it('opens on an external expand request and closes again if never hovered', async () => {
    const { listeners, island } = await renderIsland({ providers: [claude], generatedAt: now });
    act(() => listeners.expand.forEach((l) => l()));
    expect(island().className).toBe('island expanded');
    advance(4900);
    expect(island().className).toBe('island expanded');
    advance(200);
    expect(island().className).toBe('island');
  });

  it('re-renders when a new view is pushed', async () => {
    const { listeners } = await renderIsland({ providers: [claude], generatedAt: now });
    const updated: ProviderView = { ...claude, maxPercent: 88, headlinePercent: 88, level: 'warn' };
    act(() => listeners.view.forEach((l) => l({ providers: [updated], generatedAt: now + 1 })));
    expect(screen.getByTestId('pill-claude').querySelector('.pill-text')?.textContent).toBe('Claude 88%');
  });
});
