// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme';

describe('applyTheme', () => {
  it('sets mode and transparency attributes and the accent variables on the root element', () => {
    const root = document.createElement('html');
    applyTheme(root, {
      mode: 'light',
      transparency: false,
      accent: { light3: '#cae7e9', light2: '#a9c7cb', light1: '#6d909b', base: '#5a7984', dark1: '#46606b', dark2: '#2d404c', dark3: '#101c28' },
    });
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.transparency).toBe('off');
    expect(root.style.getPropertyValue('--primary')).toBe('#46606b');
    expect(root.style.getPropertyValue('--on-primary')).toBe('#ffffff');

    applyTheme(root, { mode: 'dark', transparency: true, accent: null });
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.transparency).toBe('on');
    expect(root.style.getPropertyValue('--primary')).toBe('#2f67e1');
  });
});
