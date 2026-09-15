import koffi from 'koffi';
import type { ForegroundWindow } from './fullscreen';

/** Returns a reader for the current foreground window, or null when not on Windows. */
export function createForegroundReader(): (() => ForegroundWindow | null) | null {
  if (process.platform !== 'win32') return null;

  const user32 = koffi.load('user32.dll');
  // Named types are referenced by name in the prototypes below.
  koffi.pointer('HWND', koffi.opaque());
  koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });

  const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()');
  const GetWindowRect = user32.func('bool __stdcall GetWindowRect(HWND hWnd, _Out_ RECT *lpRect)');
  const GetClassNameW = user32.func('int __stdcall GetClassNameW(HWND hWnd, _Out_ uint16_t *lpClassName, int nMaxCount)');

  return () => {
    const hwnd = GetForegroundWindow();
    if (!hwnd) return null;
    const rect = { left: 0, top: 0, right: 0, bottom: 0 };
    if (!GetWindowRect(hwnd, rect)) return null;
    const buffer = Buffer.alloc(512);
    const length = GetClassNameW(hwnd, buffer, 256) as number;
    return { rect, className: buffer.toString('utf16le', 0, length * 2) };
  };
}
