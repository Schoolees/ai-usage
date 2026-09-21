import { readFile as fsReadFile, stat } from 'node:fs/promises';
import { MINUTE } from '../../../shared/time';
import type { DetectedSource, Snapshot } from '../../../shared/types';
import type { ProviderPlugin } from '../types';
import { credentialsPath, parseClaudeCredentials } from './credentials';
import { parseClaudeUsage } from './parse';
import { claudePlanLabel } from './plan-label';

export const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const CLAUDE_USAGE_HEADERS = { 'anthropic-beta': 'oauth-2025-04-20' };
const MAX_TRANSIENT_ATTEMPTS = 3;
const TRANSIENT_RETRY_DELAYS_MS = [250, 500] as const;

export interface HttpResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type HttpGet = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;

const defaultHttpGet: HttpGet = (url, headers) =>
  fetch(url, { headers, signal: AbortSignal.timeout(15_000), redirect: 'error' });

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export interface ClaudePluginDeps {
  httpGet?: HttpGet;
  readFile?: (path: string) => Promise<string>;
  statMtimeMs?: (path: string) => Promise<number>;
  sleep?: (ms: number) => Promise<void>;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function getWithTransientRetry(httpGet: HttpGet, sleep: (ms: number) => Promise<void>, url: string, headers: Record<string, string>): Promise<HttpResponse> {
  for (let attempt = 0; attempt < MAX_TRANSIENT_ATTEMPTS; attempt++) {
    try {
      const response = await httpGet(url, headers);
      if (!isTransientStatus(response.status) || attempt === MAX_TRANSIENT_ATTEMPTS - 1) return response;
      await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt] ?? TRANSIENT_RETRY_DELAYS_MS.at(-1)!);
    } catch (error) {
      if (attempt === MAX_TRANSIENT_ATTEMPTS - 1) throw error;
      await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt] ?? TRANSIENT_RETRY_DELAYS_MS.at(-1)!);
    }
  }
  throw new Error('Claude usage request did not complete');
}

export function createClaudePlugin(deps: ClaudePluginDeps = {}): ProviderPlugin {
  const httpGet = deps.httpGet ?? defaultHttpGet;
  const sleep = deps.sleep ?? defaultSleep;
  const readFile = deps.readFile ?? ((path: string) => fsReadFile(path, 'utf8'));
  const statMtimeMs = deps.statMtimeMs ?? (async (path: string) => (await stat(path)).mtimeMs);

  return {
    id: 'claude',
    name: 'Claude',
    shortName: 'Claude',
    usageUrl: 'https://claude.ai/settings/usage',
    fromLogs: false,
    staleAfterMs: 10 * MINUTE,
    notFoundMessage: 'No Claude Code login found on Windows or running WSL distros',
    intervalMs: (settings) => settings.claudeRefreshMs,

    async detectSources(candidates) {
      const found: DetectedSource[] = [];
      for (const candidate of candidates) {
        try {
          found.push({ ...candidate, lastModifiedMs: await statMtimeMs(credentialsPath(candidate.home)) });
        } catch {
          // no Claude Code login in this home
        }
      }
      return found;
    },

    async fetch(source, now): Promise<Snapshot> {
      const base = { providerId: 'claude', source, dataAsOf: now, limits: [] };

      let text: string | null = null;
      try {
        text = await readFile(credentialsPath(source.home));
      } catch {
        text = null;
      }
      const creds = text === null ? null : parseClaudeCredentials(text);
      if (!creds) return { ...base, status: 'not-found', message: `No Claude Code login found in ${source.label}` };

      const plan = claudePlanLabel(creds.subscriptionType, creds.rateLimitTier);
      if (creds.expiresAt <= now) {
        return { ...base, plan, status: 'auth-expired', message: 'Login expired · run claude to refresh' };
      }

      let res: HttpResponse;
      try {
        res = await getWithTransientRetry(httpGet, sleep, CLAUDE_USAGE_URL, { ...CLAUDE_USAGE_HEADERS, Authorization: `Bearer ${creds.accessToken}` });
      } catch {
        return { ...base, plan, status: 'error', message: "Couldn't reach Anthropic" };
      }

      if (res.status === 401 || res.status === 403) {
        return { ...base, plan, status: 'auth-expired', message: 'Login expired · run claude to refresh' };
      }
      if (res.status === 429) {
        return {
          ...base,
          plan,
          status: 'error',
          message: 'Anthropic rate-limited the usage check',
          retryAfterMs: parseRetryAfter(res.headers.get('retry-after'), now),
        };
      }
      if (res.status < 200 || res.status >= 300) {
        return { ...base, plan, status: 'error', message: `Anthropic returned HTTP ${res.status}` };
      }

      try {
        return { ...base, plan, status: 'ok', limits: parseClaudeUsage(await res.json()) };
      } catch {
        return { ...base, plan, status: 'error', message: 'Unexpected response from Anthropic' };
      }
    },
  };
}
