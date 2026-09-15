import type { Settings } from '../../shared/settings-schema';
import type { DetectedSource, Snapshot, Source } from '../../shared/types';

export interface ProviderPlugin {
  id: string;
  /** Panel group title, e.g. "ChatGPT (Codex)" */
  name: string;
  /** Pill label, e.g. "Codex" */
  shortName: string;
  /** Opened by the panel's arrow-up-right button */
  usageUrl: string;
  /** true when numbers come from local logs, so the footer shows their age */
  fromLogs: boolean;
  /** Numbers older than this are shown as stale */
  staleAfterMs: number;
  /** Message shown when no source has this provider's files */
  notFoundMessage: string;
  /** Delay between healthy runs */
  intervalMs(settings: Settings): number;
  /** Filter candidate homes down to those containing this provider's files */
  detectSources(candidates: Source[]): Promise<DetectedSource[]>;
  /** Read one source. Must not throw for expected failures; return a non-ok status instead. */
  fetch(source: Source, now: number): Promise<Snapshot>;
}
