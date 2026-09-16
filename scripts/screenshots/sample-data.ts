// Sample data for the README screenshots. Nothing here comes from a real account.
import type { IslandView } from '../../src/shared/view-model';

/** Fixed so reset times ("Resets in 2 hr 8 min") render the same on every run. The screenshot
 * script pins TZ=UTC, so these are the wall-clock times that end up in the shot. */
export const now = Date.UTC(2026, 8, 15, 17, 0);

const HOUR = 3_600_000;
const DAY = 86_400_000;
/** Claude's weekly windows both roll over at the same moment: the coming Monday evening. */
const claudeWeeklyReset = now + 6 * DAY + 4 * HOUR;

export const view: IslandView = {
  generatedAt: now,
  providers: [
    {
      id: 'claude',
      name: 'Claude',
      shortName: 'Claude',
      plan: 'Max (5x)',
      source: { kind: 'wsl', label: 'WSL · Ubuntu-24.04', home: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\you' },
      status: 'ok',
      dataAsOf: now - 60_000,
      fromLogs: false,
      maxPercent: 73,
      headlinePercent: 73,
      level: 'normal',
      stale: false,
      limits: [
        { id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: now + 2 * HOUR + 8 * 60_000, level: 'normal' },
        { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: claudeWeeklyReset, level: 'normal' },
        { id: 'seven_day_opus', label: 'Weekly · Fable', usedPercent: 14, resetsAt: claudeWeeklyReset, level: 'normal' },
      ],
    },
    {
      id: 'codex',
      name: 'ChatGPT (Codex)',
      shortName: 'Codex',
      plan: 'Plus',
      source: { kind: 'windows', label: 'Windows', home: 'C:\\Users\\you' },
      status: 'ok',
      dataAsOf: now - 3 * 3_600_000,
      fromLogs: true,
      maxPercent: 86,
      headlinePercent: 86,
      level: 'warn',
      stale: false,
      limits: [
        { id: 'codex-300m', label: '5-hour limit', usedPercent: 86, resetsAt: now + 58 * 60_000, level: 'warn' },
        { id: 'codex-10080m', label: 'Weekly limit', usedPercent: 16, resetsAt: now + 5 * DAY + 11 * HOUR, level: 'normal' },
      ],
    },
  ],
};

/** Windows 11's default blue, so the shots look like a stock Personalization setup. */
export const accent = { light3: '#99ebff', light2: '#4cc2ff', light1: '#0091f8', base: '#0078d4', dark1: '#0067c0', dark2: '#003e92', dark3: '#001a68' };
