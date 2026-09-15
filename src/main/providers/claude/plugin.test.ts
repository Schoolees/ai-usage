import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/settings-schema';
import type { Source } from '../../../shared/types';
import { CLAUDE_USAGE_URL, createClaudePlugin, parseRetryAfter, type HttpGet } from './plugin';

const now = Date.UTC(2026, 8, 15, 17, 0);
const source: Source = { kind: 'wsl', label: 'WSL · Ubuntu', home: '/home/me' };

function credentials(expiresAt: number): string {
  return JSON.stringify({
    claudeAiOauth: { accessToken: 'secret-token', expiresAt, subscriptionType: 'max', rateLimitTier: 'default_claude_max_5x' },
  });
}

function response(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return { status, headers: { get: (name: string) => headers[name.toLowerCase()] ?? null }, json: async () => body };
}

describe('parseRetryAfter', () => {
  it('accepts seconds or an HTTP date', () => {
    expect(parseRetryAfter('120', now)).toBe(120_000);
    expect(parseRetryAfter(new Date(now + 90_000).toUTCString(), now)).toBe(90_000);
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter('later', now)).toBeUndefined();
  });
});

describe('createClaudePlugin', () => {
  it('describes itself and uses the configured refresh interval', () => {
    const plugin = createClaudePlugin();
    expect(plugin).toMatchObject({ id: 'claude', name: 'Claude', shortName: 'Claude', fromLogs: false, staleAfterMs: 600_000 });
    expect(plugin.intervalMs({ ...DEFAULT_SETTINGS, claudeRefreshMs: 300_000 })).toBe(300_000);
  });

  it('detects homes that have a credentials file', async () => {
    const plugin = createClaudePlugin({
      statMtimeMs: async (path) => {
        if (path.startsWith('/home/me')) return 1234;
        throw new Error('ENOENT');
      },
    });
    const other: Source = { kind: 'windows', label: 'Windows', home: '/nope' };
    expect(await plugin.detectSources([source, other])).toEqual([{ ...source, lastModifiedMs: 1234 }]);
  });

  it('fetches usage with the bearer token and returns ok limits', async () => {
    const httpGet = vi.fn<HttpGet>(async () =>
      response(200, { five_hour: { utilization: 73, resets_at: '2026-09-15T19:00:00.000000+00:00' } }),
    );
    const plugin = createClaudePlugin({ httpGet, readFile: async () => credentials(now + 60_000) });

    const snapshot = await plugin.fetch(source, now);

    expect(httpGet).toHaveBeenCalledWith(CLAUDE_USAGE_URL, expect.objectContaining({ Authorization: 'Bearer secret-token' }));
    expect(snapshot).toEqual({
      providerId: 'claude',
      source,
      plan: 'Max (5x)',
      status: 'ok',
      dataAsOf: now,
      limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: Date.UTC(2026, 8, 15, 19, 0) }],
    });
  });

  it('reports auth-expired without calling the API when the token has expired', async () => {
    const httpGet = vi.fn<HttpGet>();
    const plugin = createClaudePlugin({ httpGet, readFile: async () => credentials(now - 1) });
    expect(await plugin.fetch(source, now)).toMatchObject({ status: 'auth-expired', plan: 'Max (5x)', limits: [] });
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('reports not-found when credentials are missing', async () => {
    const plugin = createClaudePlugin({
      readFile: async () => {
        throw new Error('ENOENT');
      },
    });
    expect(await plugin.fetch(source, now)).toMatchObject({ status: 'not-found', message: 'No Claude Code login found in WSL · Ubuntu' });
  });

  it.each([401, 403])('maps HTTP %i to auth-expired', async (status) => {
    const plugin = createClaudePlugin({ httpGet: async () => response(status), readFile: async () => credentials(now + 60_000) });
    expect((await plugin.fetch(source, now)).status).toBe('auth-expired');
  });

  it('maps HTTP 429 to error with retryAfterMs', async () => {
    const plugin = createClaudePlugin({
      httpGet: async () => response(429, {}, { 'retry-after': '300' }),
      readFile: async () => credentials(now + 60_000),
    });
    expect(await plugin.fetch(source, now)).toMatchObject({ status: 'error', retryAfterMs: 300_000 });
  });

  it('maps network failures and bad bodies to error without leaking the token', async () => {
    const offline = createClaudePlugin({
      httpGet: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
      readFile: async () => credentials(now + 60_000),
    });
    const offlineSnapshot = await offline.fetch(source, now);
    expect(offlineSnapshot).toMatchObject({ status: 'error', message: "Couldn't reach Anthropic" });

    const garbage = createClaudePlugin({ httpGet: async () => response(200, 'nope'), readFile: async () => credentials(now + 60_000) });
    const garbageSnapshot = await garbage.fetch(source, now);
    expect(garbageSnapshot).toMatchObject({ status: 'error', message: 'Unexpected response from Anthropic' });

    expect(JSON.stringify([offlineSnapshot, garbageSnapshot])).not.toContain('secret-token');
  });
});
