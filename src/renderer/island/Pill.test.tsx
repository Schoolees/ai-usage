// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProviderView } from '../../shared/view-model';
import { Pill } from './Pill';

import { claude, codex, now } from './test-fixtures';

describe('Pill', () => {
  it('shows each provider short name with its highest percent and state', () => {
    render(<Pill providers={[claude, codex]} expanded={false} onClick={() => {}} />);
    expect(screen.getByTestId('pill-claude').textContent).toBe('Claude 73%');
    expect(screen.getByTestId('pill-claude').dataset.state).toBe('normal');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('critical');
  });

  it('marks stale and no-data providers', () => {
    const stale: ProviderView = { ...claude, status: 'auth-expired' };
    const empty: ProviderView = { ...codex, status: 'not-found', limits: [], maxPercent: null, level: 'normal' };
    render(<Pill providers={[stale, empty]} expanded={false} onClick={() => {}} />);
    expect(screen.getByTestId('pill-claude').dataset.state).toBe('stale');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('no-data');
    expect(screen.getByTestId('pill-codex').textContent).toBe('Codex');
  });

  it('calls onClick and exposes the expanded state', () => {
    const onClick = vi.fn();
    render(<Pill providers={[claude]} expanded onClick={onClick} />);
    const button = screen.getByRole('button', { name: /usage details/i });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
