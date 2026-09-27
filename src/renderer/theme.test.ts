// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme';

describe('applyTheme', () => {
  it('sets mode and transparency attributes on the root element', () => {
    const root = document.createElement('html');
    applyTheme(root, { mode: 'light', transparency: false });
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.transparency).toBe('off');

    applyTheme(root, { mode: 'dark', transparency: true });
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.transparency).toBe('on');
  });
});
