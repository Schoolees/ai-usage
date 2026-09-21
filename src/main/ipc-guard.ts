import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron';

type IpcEvent = Pick<IpcMainEvent | IpcMainInvokeEvent, 'sender' | 'senderFrame'>;

/**
 * IPC sender validation: the request came from the top frame of one of the windows allowed to make
 * it, not from another window or from an iframe inside one.
 */
export function fromWindow(event: IpcEvent, allowed: readonly (WebContents | null | undefined)[]): boolean {
  if (!allowed.includes(event.sender)) return false;
  const frame = event.senderFrame;
  return frame !== null && frame !== undefined && frame.parent === null;
}

/** An island size the renderer measured: a positive whole-ish number of pixels, not NaN or a screen-swallowing value. */
export function isPixelSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 4000;
}

export function isOptionalAge(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
