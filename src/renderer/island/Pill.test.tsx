// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProviderView } from '../../shared/view-model';
import { Pill } from './Pill';

import { claude, codex, now } from './test-fixtures';

describe('Pill', () => {
  it('shows each provider short name with its highest percent and state', () => {
    render(<Pill providers={[claude, codex]} expanded={false} onHoverStart={() => {}} onHoverEnd={() => {}} />);
    expect(screen.getByTestId('pill-claude').querySelector('.pill-text')?.textContent).toBe('Claude 73%');
    expect(screen.getByTestId('pill-claude-plan').textContent).toBe('MAX');
    expect(screen.getByTestId('pill-codex-plan').textContent).toBe('PRO LITE');
    expect(screen.getByTestId('pill-claude').dataset.state).toBe('normal');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('critical');
  });

  it('shows the headline (shortest-window) percent, colored by the worst window', () => {
    const provider: ProviderView = { ...codex, headlinePercent: 12, maxPercent: 97, level: 'critical' };
    render(<Pill providers={[provider]} expanded={false} onHoverStart={() => {}} onHoverEnd={() => {}} />);
    expect(screen.getByTestId('pill-codex').querySelector('.pill-text')?.textContent).toBe('Codex 12%');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('critical');
  });

  it('omits the plan badge when the plan is unknown', () => {
    render(<Pill providers={[{ ...claude, plan: undefined }]} expanded={false} onHoverStart={() => {}} onHoverEnd={() => {}} />);
    expect(screen.queryByTestId('pill-claude-plan')).toBeNull();
  });

  it('marks stale and no-data providers', () => {
    const stale: ProviderView = { ...claude, status: 'auth-expired', stale: true };
    const empty: ProviderView = { ...codex, status: 'not-found', limits: [], maxPercent: null, headlinePercent: null, level: 'normal', stale: true };
    render(<Pill providers={[stale, empty]} expanded={false} onHoverStart={() => {}} onHoverEnd={() => {}} />);
    expect(screen.getByTestId('pill-claude').dataset.state).toBe('stale');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('no-data');
    expect(screen.getByTestId('pill-codex').querySelector('.pill-text')?.textContent).toBe('Codex');
  });

  it('keeps a critical state through a transient error while last-good data is fresh', () => {
    const transientError: ProviderView = { ...codex, status: 'error', stale: false };
    render(<Pill providers={[transientError]} expanded={false} onHoverStart={() => {}} onHoverEnd={() => {}} />);
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('critical');
  });

  it('reports hover start and end and exposes the expanded state', () => {
    const onHoverStart = vi.fn();
    const onHoverEnd = vi.fn();
    render(<Pill providers={[claude]} expanded onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} />);
    const pill = screen.getByRole('button', { name: /usage details/i });
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    fireEvent.mouseEnter(pill);
    expect(onHoverStart).toHaveBeenCalledOnce();
    fireEvent.mouseLeave(pill);
    expect(onHoverEnd).toHaveBeenCalledOnce();
  });
});
