// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProviderView } from '../../shared/view-model';
import { Panel, footerText } from './Panel';
import { statusText } from './StatusLine';

import { claude, codex, now } from './test-fixtures';

const handlers = () => ({ onRefresh: vi.fn(), onOpenSettings: vi.fn(), onOpenUsage: vi.fn() });

describe('Panel', () => {
  it('renders a group per provider with plan, source and limit rows', () => {
    render(<Panel view={{ providers: [claude, codex], generatedAt: now }} now={now} {...handlers()} />);
    expect(screen.getByText('Claude · Max (5x)')).toBeTruthy();
    expect(screen.getByText('WSL · Ubuntu')).toBeTruthy();
    expect(screen.getByText('ChatGPT (Codex) · Pro Lite')).toBeTruthy();
    const row = screen.getByTestId('limit-five_hour');
    expect(row.textContent).toContain('5-hour limit');
    expect(row.textContent).toContain('Resets in 2 hr 8 min');
    expect(row.textContent).toContain('73%');
    expect(screen.getByTestId('limit-codex-10080m').querySelector('.fill')?.className).toContain('level-critical');
  });

  it('wires the header and footer buttons', () => {
    const h = handlers();
    render(<Panel view={{ providers: [claude], generatedAt: now }} now={now} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Claude usage page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(h.onOpenUsage).toHaveBeenCalledWith('claude');
    expect(h.onRefresh).toHaveBeenCalledOnce();
    expect(h.onOpenSettings).toHaveBeenCalledOnce();
  });

  it('shows a status line and dims rows for a non-ok provider', () => {
    const expired: ProviderView = { ...claude, status: 'auth-expired', message: 'Login expired · run claude to refresh' };
    render(<Panel view={{ providers: [expired], generatedAt: now }} now={now} {...handlers()} />);
    expect(screen.getByRole('status').textContent).toContain('Login expired · run claude to refresh');
    expect(screen.getByTestId('limit-five_hour').className).toContain('dim');
  });

  it('hides the percent for a window that has reset', () => {
    const reset: ProviderView = { ...codex, limits: [{ ...codex.limits[0], usedPercent: null, resetsAt: now - 1, level: 'normal' }] };
    render(<Panel view={{ providers: [reset], generatedAt: now }} now={now} {...handlers()} />);
    const row = screen.getByTestId('limit-codex-10080m');
    expect(row.textContent).toContain('Reset since last seen');
    expect(row.textContent).not.toContain('%');
  });
});

describe('statusText', () => {
  it('adds the retry countdown to errors', () => {
    expect(statusText({ ...claude, status: 'error', message: "Couldn't reach Anthropic", retryAt: now + 120_000 }, now)).toBe(
      "Couldn't reach Anthropic · retrying in 2 min",
    );
  });

  it('describes stale data by age', () => {
    expect(statusText({ ...claude, status: 'stale', dataAsOf: now - 15 * 60_000 }, now)).toBe('Data is 15 min old');
    expect(statusText({ ...claude, status: 'stale', limits: [], dataAsOf: null, message: 'Checking…' }, now)).toBe('Checking…');
  });
});

describe('footerText', () => {
  it('combines the live update time with log ages', () => {
    expect(footerText([claude, codex], now)).toBe('Updated 1 min ago · Codex from logs, 3 hr old');
  });

  it('waits when nothing has arrived yet', () => {
    expect(footerText([{ ...claude, dataAsOf: null }], now)).toBe('Waiting for data');
  });
});
