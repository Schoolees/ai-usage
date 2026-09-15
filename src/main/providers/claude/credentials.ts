import { join } from 'node:path';

export interface ClaudeCredentials {
  accessToken: string;
  expiresAt: number;
  subscriptionType?: string;
  rateLimitTier?: string;
}

export function credentialsPath(home: string): string {
  return join(home, '.claude', '.credentials.json');
}

/** Pick only what the plugin needs; the refresh token is deliberately never read. */
export function parseClaudeCredentials(text: string): ClaudeCredentials | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const oauth = (parsed as { claudeAiOauth?: Record<string, unknown> } | null)?.claudeAiOauth;
  if (!oauth || typeof oauth.accessToken !== 'string' || typeof oauth.expiresAt !== 'number') return null;
  return {
    accessToken: oauth.accessToken,
    expiresAt: oauth.expiresAt,
    subscriptionType: typeof oauth.subscriptionType === 'string' ? oauth.subscriptionType : undefined,
    rateLimitTier: typeof oauth.rateLimitTier === 'string' ? oauth.rateLimitTier : undefined,
  };
}
