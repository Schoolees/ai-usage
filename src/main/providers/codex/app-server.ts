import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Source } from '../../../shared/types';
import { distroFromHome } from '../../sources/detect';
import { systemExe } from '../../system-exe';
import type { CodexRateLimitRecord, CodexWindow } from './parse';

const REQUEST_TIMEOUT_MS = 15_000;

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  result?: unknown;
  error?: { message?: unknown };
}

interface AppServerRateLimitWindow {
  usedPercent?: unknown;
  used_percent?: unknown;
  windowDurationMins?: unknown;
  window_minutes?: unknown;
  resetsAt?: unknown;
  resets_at?: unknown;
}

interface AppServerRateLimits {
  planType?: unknown;
  plan_type?: unknown;
  primary?: unknown;
  secondary?: unknown;
}

interface AppServerResponse {
  rateLimits?: unknown;
  rate_limits?: unknown;
  rateLimitsByLimitId?: unknown;
  rate_limits_by_limit_id?: unknown;
}

function appServerCommand(source: Source): { file: string; args: string[] } | null {
  if (source.kind !== 'wsl') return { file: 'codex', args: ['app-server', '--stdio'] };
  const distro = distroFromHome(source.home);
  if (!distro) return null;
  return { file: systemExe('wsl.exe'), args: ['-d', distro, '--', 'bash', '-lc', 'exec codex app-server --stdio'] };
}

function codexHome(source: Source): string {
  if (source.kind === 'windows') return join(source.home, '.codex');
  const match = /^\\\\wsl\.localhost\\[^\\]+(\\.*)$/.exec(source.home);
  return match ? match[1].replaceAll('\\', '/') + '/.codex' : join(source.home, '.codex');
}

function asWindow(value: unknown): CodexWindow | null {
  if (!value || typeof value !== 'object') return null;
  const window = value as AppServerRateLimitWindow;
  const usedPercent = typeof window.usedPercent === 'number' ? window.usedPercent : window.used_percent;
  const windowMinutes = typeof window.windowDurationMins === 'number' ? window.windowDurationMins : window.window_minutes;
  const resetsAt = typeof window.resetsAt === 'number' ? window.resetsAt : window.resets_at;
  if (typeof usedPercent !== 'number' || typeof windowMinutes !== 'number') return null;
  return { usedPercent, windowMinutes, resetsAtSec: typeof resetsAt === 'number' ? resetsAt : null };
}

export function parseRateLimitsResponse(message: unknown, timestampMs: number): CodexRateLimitRecord | null {
  if (!message || typeof message !== 'object') return null;
  const response = message as AppServerResponse;
  const byLimitId = response.rateLimitsByLimitId ?? response.rate_limits_by_limit_id;
  const codexBucket = byLimitId && typeof byLimitId === 'object' ? (byLimitId as Record<string, unknown>).codex : undefined;
  const rateLimits = codexBucket ?? response.rateLimits ?? response.rate_limits;
  if (!rateLimits || typeof rateLimits !== 'object') return null;
  const value = rateLimits as AppServerRateLimits;
  const primary = asWindow(value.primary);
  const secondary = asWindow(value.secondary);
  if (!primary && !secondary) return null;
  return {
    timestampMs,
    planType: typeof value.planType === 'string' ? value.planType : typeof value.plan_type === 'string' ? value.plan_type : null,
    primary,
    secondary,
  };
}

function parseLine(line: string): JsonRpcMessage | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return parsed && typeof parsed === 'object' ? (parsed as JsonRpcMessage) : null;
  } catch {
    return null;
  }
}

function stop(child: ChildProcessWithoutNullStreams): void {
  if (!child.killed) child.kill();
}

/** Read the current account-wide limit snapshot from Codex's authenticated app-server. */
export function readAppServerRateLimits(source: Source, now: number): Promise<CodexRateLimitRecord> {
  const command = appServerCommand(source);
  if (!command) return Promise.reject(new Error(`Cannot start Codex app-server for ${source.label}`));

  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = '';
    let initialized = false;
    const child = spawn(command.file, command.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // `codex` is found through PATH, so start from a known folder rather than wherever the app was launched.
      cwd: homedir(),
      env: { ...process.env, CODEX_HOME: codexHome(source) },
    });
    const finish = (error?: Error, record?: CodexRateLimitRecord) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stop(child);
      if (error) reject(error);
      else if (record) resolve(record);
      else reject(new Error('Codex app-server returned no rate limits'));
    };
    const consume = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = parseLine(line);
        if (!message) continue;
        if (message.id === 1) {
          if (message.error) {
            finish(new Error(typeof message.error.message === 'string' ? message.error.message : 'Codex app-server initialization failed'));
            return;
          }
          if (!initialized) {
            initialized = true;
            write({ jsonrpc: '2.0', method: 'initialized', params: {} });
            write({ jsonrpc: '2.0', id: 2, method: 'account/rateLimits/read', params: { excludeResetCreditDetails: true } });
          }
          continue;
        }
        if (message.id !== 2) continue;
        if (message.error) {
          finish(new Error(typeof message.error.message === 'string' ? message.error.message : 'Codex app-server request failed'));
          return;
        }
        const record = parseRateLimitsResponse(message.result, now);
        finish(undefined, record ?? undefined);
        return;
      }
    };
    const timer = setTimeout(() => finish(new Error('Codex app-server timed out')), REQUEST_TIMEOUT_MS);
    const write = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
    child.stdout.on('data', consume);
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (!settled) finish(new Error(`Codex app-server exited before returning usage${code === null ? '' : ` (code ${code})`}`));
    });
    child.stdin.on('error', (error) => finish(error));

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'ai-usage', version: '0.1.10' }, capabilities: {} } })}\n`);
  });
}
