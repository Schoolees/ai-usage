// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select, type SelectOption } from './Select';

const sources: SelectOption[] = [
  { value: '', label: 'Automatic (most recently used)' },
  { value: 'wsl', label: 'WSL · Ubuntu-24.04', detail: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\me' },
  { value: 'win', label: 'Windows', detail: 'C:\\Users\\Raymond' },
];

const many: SelectOption[] = ['Light', 'Dark', 'GitHub Light', 'One Light', 'Solarized Light', 'Min Light', 'Vitesse Light'].map((label) => ({
  value: label.toLowerCase(),
  label,
}));

function setup(options = sources, value = '') {
  const onChange = vi.fn();
  render(<Select label="Claude source" value={value} options={options} onChange={onChange} />);
  const trigger = screen.getByRole('button', { name: 'Claude source' });
  return { onChange, trigger };
}

describe('Select', () => {
  it('shows the selected option on a closed trigger', () => {
    const { trigger } = setup(sources, 'wsl');
    expect(trigger.textContent).toContain('WSL · Ubuntu-24.04');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens a listbox that marks the selected option, and picks an option on click', () => {
    const { trigger, onChange } = setup(sources, 'wsl');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const selected = screen.getByRole('option', { name: /WSL · Ubuntu-24.04/ });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.querySelector('svg')).toBeTruthy(); // check mark

    fireEvent.click(screen.getByRole('option', { name: /Windows/ }));
    expect(onChange).toHaveBeenCalledWith('win');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('supports the keyboard: ArrowDown opens and moves, Enter picks, Escape closes', () => {
    const { trigger, onChange } = setup(sources, '');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('wsl');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('closes when clicking outside without changing the value', () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds a search box for long lists that filters options', () => {
    const { trigger, onChange } = setup(many, 'light');
    fireEvent.click(trigger);
    const search = screen.getByRole('searchbox', { name: 'Search options' });
    fireEvent.change(search, { target: { value: 'sol' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Solarized Light']);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('solarized light');

    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search options' }), { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('has no search box for short lists', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
