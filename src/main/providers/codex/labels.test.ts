import { describe, expect, it } from 'vitest';
import { codexPlanLabel, windowLabel } from './labels';

describe('windowLabel', () => {
  it.each([
    [300, '5-hour limit'],
    [10080, 'Weekly limit'],
    [43200, '30-day limit'],
    [1440, '1-day limit'],
    [120, '2-hour limit'],
    [45, '45-minute limit'],
  ])('%i minutes → %s', (minutes, label) => {
    expect(windowLabel(minutes)).toBe(label);
  });
});

describe('codexPlanLabel', () => {
  it('maps known plan types', () => {
    expect(codexPlanLabel('prolite')).toBe('Pro Lite');
    expect(codexPlanLabel('plus')).toBe('Plus');
    expect(codexPlanLabel('free')).toBe('Free');
  });

  it('capitalizes unknown plan types and passes through empty values', () => {
    expect(codexPlanLabel('ultra')).toBe('Ultra');
    expect(codexPlanLabel(null)).toBeUndefined();
    expect(codexPlanLabel(undefined)).toBeUndefined();
  });
});
