import { describe, expect, it } from 'vitest';
import { islandBounds, pickDisplay, type DisplayInfo } from './island-geometry';

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const primary: DisplayInfo = { id: 1, label: 'Display 1', primary: true, bounds: rect(0, 0, 1920, 1080), workArea: rect(0, 0, 1920, 1040) };
const side: DisplayInfo = { id: 2, label: 'Display 2', primary: false, bounds: rect(1920, 0, 2560, 1440), workArea: rect(1920, 0, 2560, 1400) };

describe('pickDisplay', () => {
  it('uses the preferred display when connected', () => {
    expect(pickDisplay([primary, side], 2)).toBe(side);
  });

  it('falls back to the primary display', () => {
    expect(pickDisplay([side, primary], 99)).toBe(primary);
    expect(pickDisplay([side, primary], null)).toBe(primary);
  });

  it('falls back to the first display when none is primary', () => {
    expect(pickDisplay([{ ...side, primary: false }], null).id).toBe(2);
  });
});

describe('islandBounds', () => {
  it('centers the island at the top of the work area', () => {
    expect(islandBounds(side.workArea, { width: 260.4, height: 33.2 })).toEqual({ x: 1920 + 1150, y: 0, width: 261, height: 34 });
  });

  it('respects a taskbar docked at the top', () => {
    expect(islandBounds(rect(0, 48, 1920, 1032), { width: 300, height: 40 })).toEqual({ x: 810, y: 48, width: 300, height: 40 });
  });

  it('never exceeds the work area width', () => {
    expect(islandBounds(rect(0, 0, 200, 1000), { width: 360, height: 300 }).width).toBe(200);
  });
});
