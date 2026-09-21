import type { WebContents } from 'electron';
import { describe, expect, it } from 'vitest';
import { fromWindow, isOptionalAge, isPixelSize, isPlainObject } from './ipc-guard';

const island = { id: 1 } as unknown as WebContents;
const settings = { id: 2 } as unknown as WebContents;
const top = { parent: null };
const event = (sender: WebContents, senderFrame: unknown = top) => ({ sender, senderFrame }) as Parameters<typeof fromWindow>[0];

describe('fromWindow', () => {
  it('accepts the top frame of an allowed window', () => {
    expect(fromWindow(event(island), [island])).toBe(true);
  });

  it('refuses a window that is not on the list', () => {
    expect(fromWindow(event(settings), [island])).toBe(false);
  });

  it('refuses an iframe inside an allowed window', () => {
    expect(fromWindow(event(island, { parent: top }), [island])).toBe(false);
  });

  it('refuses a request whose frame is already gone', () => {
    expect(fromWindow(event(island, null), [island])).toBe(false);
  });

  it('ignores a closed window in the list', () => {
    expect(fromWindow(event(island), [null, island])).toBe(true);
  });
});

describe('argument checks', () => {
  it('takes only sane island sizes', () => {
    expect(isPixelSize(260)).toBe(true);
    for (const bad of [0, -1, Number.NaN, Infinity, 1e6, '260', undefined]) expect(isPixelSize(bad)).toBe(false);
  });

  it('takes an absent or non-negative refresh age', () => {
    expect(isOptionalAge(undefined)).toBe(true);
    expect(isOptionalAge(0)).toBe(true);
    for (const bad of [-1, Number.NaN, '5', null]) expect(isOptionalAge(bad)).toBe(false);
  });

  it('takes only a plain object as a settings patch', () => {
    expect(isPlainObject({ warnPercent: 70 })).toBe(true);
    for (const bad of [null, [], 'x', 1]) expect(isPlainObject(bad)).toBe(false);
  });
});
