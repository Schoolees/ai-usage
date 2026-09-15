// Throwaway spike: prints the Claude usage response. Never prints the token.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'https://api.anthropic.com/api/oauth/usage';
const creds = JSON.parse(readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8')).claudeAiOauth;
if (creds.expiresAt <= Date.now()) {
  console.error('Token expired: run `claude` once, then retry.');
  process.exit(1);
}
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${creds.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
});
console.error('HTTP', res.status, res.headers.get('content-type'), 'retry-after:', res.headers.get('retry-after'));
console.log(await res.text());
