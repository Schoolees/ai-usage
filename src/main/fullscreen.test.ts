import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenWatch, coversDisplay, type ForegroundWindow } from './fullscreen';

const display = { x: 0, y: 0, width: 1920, height: 1080 };
const win = (left: number, top: number, right: number, bottom: number, className = 'Chrome_WidgetWin_1'): ForegroundWindow => ({
  rect: { left, top, right, bottom },
  className,
});

describe('coversDisplay', () => {
  it('is true for a window covering the whole display', () => {
    expect(coversDisplay(win(0, 0, 1920, 1080), display)).toBe(true);
  });

  it('is false for a maximized window that leaves the taskbar visible', () => {
    expect(coversDisplay(win(-8, -8, 1928, 1048), display)).toBe(false);
  });

  it('is false for the desktop and shell windows', () => {
    expect(coversDisplay(win(0, 0, 1920, 1080, 'Progman'), display)).toBe(false);
    expect(coversDisplay(win(0, 0, 1920, 1080, 'WorkerW'), display)).toBe(false);
  });
});

describe('FullscreenWatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports changes only when the fullscreen state flips', () => {
    let current: ForegroundWindow | null = win(0, 0, 800, 600);
    const onChange = vi.fn();
    const watch = new FullscreenWatch(() => current, () => display, onChange, 1500);

    watch.start();
    vi.advanceTimersByTime(1500);
    expect(onChange).not.toHaveBeenCalled();

    current = win(0, 0, 1920, 1080);
    vi.advanceTimersByTime(1500);
    vi.advanceTimersByTime(1500);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    watch.stop();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('treats reader errors as not fullscreen', () => {
    const onChange = vi.fn();
    const watch = new FullscreenWatch(() => {
      throw new Error('user32 failed');
    }, () => display, onChange);
    watch.tick();
    expect(onChange).not.toHaveBeenCalled();
  });
});
