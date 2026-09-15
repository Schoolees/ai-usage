import { describe, expect, it } from 'vitest';
import { claudePlanLabel } from './plan-label';

describe('claudePlanLabel', () => {
  it('adds the Max multiplier from the rate-limit tier', () => {
    expect(claudePlanLabel('max', 'default_claude_max_5x')).toBe('Max (5x)');
    expect(claudePlanLabel('max', 'default_claude_max_20x')).toBe('Max (20x)');
  });

  it('capitalizes plans without a multiplier', () => {
    expect(claudePlanLabel('pro', 'default_claude_pro')).toBe('Pro');
    expect(claudePlanLabel('team', null)).toBe('Team');
  });

  it('returns undefined without a subscription type', () => {
    expect(claudePlanLabel(undefined, 'default_claude_max_5x')).toBeUndefined();
  });
});
