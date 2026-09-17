import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findLastRateLimits, newestTokenCountMs } from '../parse';

/**
 * A corpus of real log shapes seen in the wild (with synthetic numbers). Each one caused a bug once;
 * keeping them here means a future change to the parser has to keep handling all of them.
 */
const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

describe('Codex log fixtures', () => {
  it('reads a normal session: the newest token_count record wins', () => {
    expect(findLastRateLimits(read('session-with-limits.jsonl'))).toMatchObject({
      planType: 'plus',
      primary: { usedPercent: 42, windowMinutes: 300 },
      secondary: { usedPercent: 18, windowMinutes: 10080 },
    });
  });

  it('skips trailing limit_id "premium" records that carry no windows', () => {
    expect(findLastRateLimits(read('trailing-premium-records.jsonl'))).toMatchObject({
      primary: { usedPercent: 78, windowMinutes: 300 },
      secondary: { usedPercent: 33, windowMinutes: 10080 },
    });
  });

  it('reads a thread reopened hours later, before the model has replied', () => {
    // Reopening appends context records straight away; usage only arrives with the first response.
    const jsonl = read('resumed-thread.jsonl');
    const record = findLastRateLimits(jsonl);
    expect(record).toMatchObject({ primary: { usedPercent: 56 }, secondary: { usedPercent: 49 } });
    // Nothing newer is accounting tokens yet, so the old record is simply the latest there is.
    expect(newestTokenCountMs(jsonl)).toBe(record?.timestampMs);
  });
});
