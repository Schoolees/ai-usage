import type { Rect } from './island-geometry';

export interface ForegroundWindow {
  /** Physical pixels, as returned by GetWindowRect */
  rect: { left: number; top: number; right: number; bottom: number };
  className: string;
}

const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);

export function coversDisplay(window: ForegroundWindow, displayBoundsPx: Rect): boolean {
  if (SHELL_CLASSES.has(window.className)) return false;
  const { left, top, right, bottom } = window.rect;
  return (
    left <= displayBoundsPx.x &&
    top <= displayBoundsPx.y &&
    right >= displayBoundsPx.x + displayBoundsPx.width &&
    bottom >= displayBoundsPx.y + displayBoundsPx.height
  );
}

export class FullscreenWatch {
  private timer?: ReturnType<typeof setInterval>;
  private fullscreen = false;

  constructor(
    private readonly read: () => ForegroundWindow | null,
    private readonly displayBoundsPx: () => Rect,
    private readonly onChange: (fullscreen: boolean) => void,
    private readonly intervalMs = 1500,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.fullscreen) {
      this.fullscreen = false;
      this.onChange(false);
    }
  }

  tick(): void {
    let next = false;
    try {
      const window = this.read();
      next = window !== null && coversDisplay(window, this.displayBoundsPx());
    } catch {
      next = false;
    }
    if (next !== this.fullscreen) {
      this.fullscreen = next;
      this.onChange(next);
    }
  }
}
