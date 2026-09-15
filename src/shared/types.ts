export type ProviderStatus = 'ok' | 'stale' | 'auth-expired' | 'not-found' | 'error';

export type SourceKind = 'windows' | 'wsl';

/** A home folder that may contain a provider's CLI credentials or logs. */
export interface Source {
  kind: SourceKind;
  /** "Windows", "Local" (non-Windows dev) or "WSL · Ubuntu" */
  label: string;
  /** C:\Users\Raymond  or  \\wsl.localhost\Ubuntu\home\rpbaguio */
  home: string;
}

export interface DetectedSource extends Source {
  /** mtime of the provider's credential or newest log file; the newest wins by default */
  lastModifiedMs: number;
}

export interface Limit {
  id: string;
  label: string;
  /** 0–100, or null when the window has reset since the data was recorded */
  usedPercent: number | null;
  /** epoch ms rounded to the minute, or null when the provider gives no reset time */
  resetsAt: number | null;
}

export interface Snapshot {
  providerId: string;
  source: Source | null;
  plan?: string;
  status: ProviderStatus;
  /** epoch ms the numbers describe: fetch time for live calls, record time for logs */
  dataAsOf: number;
  limits: Limit[];
  message?: string;
  retryAfterMs?: number;
}
