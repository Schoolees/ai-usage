import { describe, expect, it } from 'vitest';
import { alertText } from './alert-text';

const now = Date.UTC(2026, 8, 15, 17, 0);

describe('alertText', () => {
  it('describes a threshold crossing with the reset time', () => {
    expect(
      alertText(
        { kind: 'threshold', providerId: 'claude', limitId: 'five_hour', limitLabel: '5-hour limit', percent: 82.4, threshold: 80, resetsAt: now + 2 * 3_600_000 },
        'Claude',
        now,
      ),
    ).toEqual({ title: 'Claude · 5-hour limit at 82%', body: 'Passed 80% · Resets in 2 hr' });
  });

  it('omits the reset time when unknown', () => {
    expect(
      alertText({ kind: 'threshold', providerId: 'codex', limitId: 'codex-10080m', limitLabel: 'Weekly limit', percent: 95, threshold: 95, resetsAt: null }, 'ChatGPT (Codex)', now).body,
    ).toBe('Passed 95%');
  });

  it('describes a reset', () => {
    expect(alertText({ kind: 'reset', providerId: 'claude', limitId: 'five_hour', limitLabel: '5-hour limit' }, 'Claude', now)).toEqual({
      title: 'Claude · 5-hour limit has reset',
      body: 'A new usage window has started',
    });
  });
});
