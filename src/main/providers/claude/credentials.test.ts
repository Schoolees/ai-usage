import { describe, expect, it } from 'vitest';
import { parseClaudeCredentials } from './credentials';

describe('parseClaudeCredentials', () => {
  it('extracts the fields the plugin needs', () => {
    const text = JSON.stringify({
      claudeAiOauth: {
        accessToken: 'tok',
        refreshToken: 'never-used',
        expiresAt: 1789455310647,
        subscriptionType: 'max',
        rateLimitTier: 'default_claude_max_5x',
      },
      mcpOAuth: {},
    });
    expect(parseClaudeCredentials(text)).toEqual({
      accessToken: 'tok',
      expiresAt: 1789455310647,
      subscriptionType: 'max',
      rateLimitTier: 'default_claude_max_5x',
    });
  });

  it('returns null for invalid JSON or a missing OAuth block', () => {
    expect(parseClaudeCredentials('{nope')).toBeNull();
    expect(parseClaudeCredentials('{"mcpOAuth":{}}')).toBeNull();
    expect(parseClaudeCredentials('{"claudeAiOauth":{"accessToken":"t"}}')).toBeNull();
  });

  it('rejects empty or non-finite OAuth credentials', () => {
    expect(parseClaudeCredentials('{"claudeAiOauth":{"accessToken":"","expiresAt":1}}')).toBeNull();
    expect(parseClaudeCredentials('{"claudeAiOauth":{"accessToken":"t","expiresAt":null}}')).toBeNull();
  });
});
