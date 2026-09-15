import type { ProviderView } from '../../shared/view-model';

export const now = Date.UTC(2026, 8, 15, 17, 0);

export const claude: ProviderView = {
  id: 'claude', name: 'Claude', shortName: 'Claude', plan: 'Max (5x)',
  source: { kind: 'wsl', label: 'WSL · Ubuntu', home: '/home/me' },
  status: 'ok', dataAsOf: now - 60_000, fromLogs: false, maxPercent: 73, headlinePercent: 73, level: 'normal', stale: false,
  limits: [
    { id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: now + 2 * 3_600_000 + 8 * 60_000, level: 'normal' },
    { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: now + 3 * 86_400_000, level: 'normal' },
  ],
};

export const codex: ProviderView = {
  id: 'codex', name: 'ChatGPT (Codex)', shortName: 'Codex', plan: 'Pro Lite',
  source: { kind: 'windows', label: 'Windows', home: 'C:\\Users\\you' },
  status: 'ok', dataAsOf: now - 3 * 3_600_000, fromLogs: true, maxPercent: 97, headlinePercent: 97, level: 'critical', stale: false,
  limits: [{ id: 'codex-10080m', label: 'Weekly limit', usedPercent: 97, resetsAt: now + 2 * 86_400_000, level: 'critical' }],
};
