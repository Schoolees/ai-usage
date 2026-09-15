import { formatPercent, formatReset } from '../shared/format';
import type { AlertEvent } from './alert-engine';

export function alertText(event: AlertEvent, providerName: string, now: number): { title: string; body: string } {
  if (event.kind === 'reset') {
    return { title: `${providerName} · ${event.limitLabel} has reset`, body: 'A new usage window has started' };
  }
  const passed = `Passed ${event.threshold}%`;
  return {
    title: `${providerName} · ${event.limitLabel} at ${formatPercent(event.percent)}`,
    body: event.resetsAt === null ? passed : `${passed} · ${formatReset(event.resetsAt, now)}`,
  };
}
