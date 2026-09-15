# AI Usage Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Electron app that shows Claude and ChatGPT/Codex subscription usage limits in a top-center, notch-style island that expands on click.

**Architecture:**
- **Main process:** provider plugins read CLI credentials and logs from Windows and WSL homes. A scheduler polls them, a store keeps the latest and last good snapshots, and an alert engine raises Windows notifications.
- **View model:** a pure view-model builder turns store entries into data ready to draw, pushed over typed IPC.
- **Renderers:** two React pages (island, settings). Pure logic sits in `electron`-free modules so it's unit-testable in WSL with vitest.

**Tech Stack:** Electron 44.3.0, electron-vite 5.0.0, Vite 7.3.6, React 19.3.0, TypeScript 5.9.3, lucide-react 1.46.0, zod 4.6.5, koffi 3.3.0, electron-log 5.4.4, vitest 5.0.0, @testing-library/react 16.3.3, jsdom 30.0.1, electron-builder 26.15.3, sharp 0.35.4, png-to-ico 3.0.2.

**Spec:** `docs/superpowers/specs/2026-09-15-ai-usage-island-design.md`

## Global Constraints

**Scope**
- v1 tracks subscription rolling-window limits only, for providers `claude` and `codex`. No API-key balance and no context-window row.

**Tokens**
- Only the main process reads tokens.
- Tokens never go to the renderer, logs, `state.json`, `settings.json` or any other file.
- A token is sent only to its own provider's server.
- The app never refreshes or rewrites tokens.

**Island behavior**
- Expands on click only. Collapses on a second click, Esc or window blur.
- Always on top at level `'screen-saver'`, with no taskbar entry, top-center of the chosen display's `workArea`.

**Icons and look**
- All UI icons come from `lucide-react`: `TriangleAlert`, `ClockAlert`, `CloudOff`, `SquareTerminal`, `Monitor`, `ArrowUpRight`, `RefreshCw`, `Settings`, `Clock`, `Gauge`.
- Provider identity uses colored dots: claude `#d97757`, codex `#10a37f`, fallback `#8a8a8a`.

**Defaults**
- Thresholds: warn `80`, critical `95`.
- Claude refresh: `120000` ms, minimum `60000`.
- Codex check: every `30000` ms.
- Retry steps after errors: `60000, 120000, 300000, 600000` ms.
- Stale after: Claude 10 min, Codex 24 h.
- WSL probe timeout: 3000 ms. Fullscreen poll: 1500 ms. Source re-detect: every 5 min.

**Implementation rules**
- Timestamps are epoch **milliseconds** (`number`) everywhere, rounded to the minute for `resetsAt`, so snapshots serialize unchanged over IPC and into `state.json`. The spec's `Date` fields are represented this way.
- Only these files may import `electron`: `src/main/index.ts`, `app.ts`, `island-window.ts`, `settings-window.ts`, `tray.ts`, `notifier.ts`, `displays.ts`, `renderer-url.ts`, `log.ts`, `foreground-window.ts`, and `src/preload/index.ts`. Everything else stays pure and testable.
- App id: `com.rpbaguio.ai-usage`. Product name: `AI Usage`.
- `package.json` has **no** `"type": "module"`, so main and preload build as CommonJS, which sandboxed preload scripts require.

**Where commands run**
- Tests run in WSL: `npm test`.
- The real app runs on Windows through `scripts/sync-to-windows.sh`, then `npm install` and `npm run dev` in PowerShell at `C:\dev\ai-usage`.

## File Map

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` | Project manifest and TypeScript configs |
| `electron.vite.config.ts`, `vitest.config.ts`, `electron-builder.yml` | Build, test and packaging configs |
| `scripts/sync-to-windows.sh` | Copy the repo from WSL to `/mnt/c/dev/ai-usage` |
| `scripts/make-icons.mjs` | Render Lucide `gauge` → `build/icon.ico`, `resources/tray.ico` |
| `src/test-setup.ts` | RTL cleanup between tests |
| `src/shared/types.ts` | `Source`, `DetectedSource`, `Limit`, `Snapshot`, `ProviderStatus` |
| `src/shared/time.ts` | `MINUTE`, `HOUR`, `DAY`, `roundToMinute` |
| `src/shared/format.ts` | `formatReset`, `formatDuration`, `formatPercent` |
| `src/shared/settings-schema.ts` | zod `SettingsSchema`, `Settings`, `SettingsPatch`, `DEFAULT_SETTINGS`, `mergeSettings`, `providerSettings` |
| `src/shared/view-model.ts` | `LimitView`, `ProviderView`, `IslandView`, `levelFor`, `buildProviderView` |
| `src/shared/ipc.ts` | `IPC` channel names, `Api` interface, option types |
| `src/shared/app-id.ts` | `APP_ID`, `PRODUCT_NAME` |
| `src/main/providers/types.ts` | `ProviderPlugin` interface |
| `src/main/providers/index.ts` | `createProviders()` registry |
| `src/main/providers/codex/labels.ts` | `windowLabel`, `codexPlanLabel` |
| `src/main/providers/codex/parse.ts` | `findLastRateLimits`, `codexSnapshot` |
| `src/main/providers/codex/find-latest-log.ts` | `findLatestLogs`, `readTail` |
| `src/main/providers/codex/plugin.ts` | `createCodexPlugin` |
| `src/main/providers/claude/plan-label.ts` | `claudePlanLabel` |
| `src/main/providers/claude/credentials.ts` | `parseClaudeCredentials`, `credentialsPath` |
| `src/main/providers/claude/parse.ts` | `parseClaudeUsage`, `limitLabel`, `parseResetsAt` |
| `src/main/providers/claude/plugin.ts` | `createClaudePlugin`, `parseRetryAfter`, `CLAUDE_USAGE_URL` |
| `src/main/sources/detect.ts` | `parseWslList`, `listCandidateHomes`, `pickSource`, `defaultDetectDeps` |
| `src/main/json-file.ts` | `readJson`, `writeJsonAtomic` |
| `src/main/settings.ts` | `loadSettings`, `saveSettings` |
| `src/main/state-file.ts` | `loadState`, `saveState`, `PersistedState` |
| `src/main/usage-store.ts` | `UsageStore`, `StoreEntry` |
| `src/main/scheduler.ts` | `Scheduler`, `nextDelayMs`, `ScheduledTask` |
| `src/main/alert-engine.ts` | `AlertEngine`, `AlertEvent` |
| `src/main/alert-text.ts` | `alertText` |
| `src/main/redact.ts` | `redact`, `redactValue` |
| `src/main/island-geometry.ts` | `Rect`, `DisplayInfo`, `pickDisplay`, `islandBounds` |
| `src/main/fullscreen.ts` | `coversDisplay`, `FullscreenWatch`, `ForegroundWindow` |
| `src/main/foreground-window.ts` | `createForegroundReader` (koffi → user32) |
| `src/main/log.ts` | `initLog` (electron-log with redaction hook) |
| `src/main/renderer-url.ts` | `loadRenderer(win, page)` |
| `src/main/displays.ts` | `listDisplays()` (Electron `screen` → `DisplayInfo[]`) |
| `src/main/island-window.ts` | `IslandWindow` class |
| `src/main/settings-window.ts` | `openSettingsWindow` |
| `src/main/tray.ts` | `createTray` |
| `src/main/notifier.ts` | `showAlert` |
| `src/main/app.ts` | `startApp` composition root |
| `src/main/index.ts` | Lifecycle, single-instance lock, app user model id |
| `src/main/env.d.ts` | `*?asset` module type |
| `src/preload/index.ts` | `contextBridge` → `window.api` |
| `src/renderer/env.d.ts` | `Window.api` global type |
| `src/renderer/island.html`, `island/main.tsx`, `island/IslandApp.tsx`, `island/Pill.tsx`, `island/Panel.tsx`, `island/LimitRow.tsx`, `island/StatusLine.tsx`, `island/island.css` | Island UI |
| `src/renderer/settings.html`, `settings/main.tsx`, `settings/SettingsApp.tsx`, `settings/NumberInput.tsx`, `settings/settings.css` | Settings UI |

---

### Task 0: Spike: confirm usage endpoints and capture fixtures

This is throwaway investigation; only the fixtures and the spec note are kept. It runs in WSL, using the Claude Code login in `~/.claude`.

**Files:**
- Create: `scripts/spike/claude-usage.mjs`
- Create: `src/main/providers/claude/fixtures/usage.json`
- Modify: `docs/superpowers/specs/2026-09-15-ai-usage-island-design.md` (§2, append a "Spike findings" subsection)

**Interfaces:**
- Produces: `src/main/providers/claude/fixtures/usage.json`, a scrubbed real response used by Task 4 tests. It also confirms or corrects the constants `CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'` and header `anthropic-beta: oauth-2025-04-20`, and the response shape assumed by Task 4:
  ```json
  { "five_hour": { "utilization": 73.0, "resets_at": "2026-09-15T19:00:00.123456+00:00" },
    "seven_day": { "utilization": 29.0, "resets_at": "2026-09-21T13:00:00.123456+00:00" },
    "seven_day_opus": null,
    "extra_usage": { "is_enabled": false } }
  ```

- [ ] **Step 1: Make sure the Claude token is fresh**

Run: `claude -p "hi" >/dev/null` (any short Claude Code call refreshes the login), then:
`node -e "const c=require(require('os').homedir()+'/.claude/.credentials.json').claudeAiOauth; console.log('expires in min:', Math.round((c.expiresAt-Date.now())/60000))"`
Expected: a positive number of minutes.

- [ ] **Step 2: Write the spike script**

`scripts/spike/claude-usage.mjs`:
```js
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
```

- [ ] **Step 3: Run it**

Run: `node scripts/spike/claude-usage.mjs > /tmp/claude-usage.json; cat /tmp/claude-usage.json | head -c 2000`
Expected: `HTTP 200 application/json` on stderr, and JSON with `five_hour` and `seven_day` objects on stdout.

If the call returns 404 or 401, find the call Claude Code actually makes. Run `grep -o 'api/oauth/[a-z_/]*' "$(readlink -f "$(which claude)")" | sort -u` against the Claude Code bundle, retry with that path as the argument, and use whichever URL returns 200.

- [ ] **Step 4: Record the facts Task 4 depends on**

Check and write down:
1. The URL and headers that worked.
2. Whether `utilization` is 0–100 (percent) or 0–1 (fraction).
3. The `resets_at` format (ISO string or epoch seconds).
4. Every top-level key whose value has `utilization` **and** `resets_at`.

If any answer differs from the assumed shape above, note the exact difference. Task 4 Step 3 has a marked adjustment point.

- [ ] **Step 5: Save a scrubbed fixture**

Run: `jq 'walk(if type=="object" then with_entries(select(.key|test("id|email|uuid|account|org";"i")|not)) else . end)' /tmp/claude-usage.json > src/main/providers/claude/fixtures/usage.json && cat src/main/providers/claude/fixtures/usage.json`
Expected: the same windows with no IDs, emails or account fields. Confirm by eye that no token-like string is present.

- [ ] **Step 6: Check for a live ChatGPT usage call (optional source)**

Run: `grep -rhoE 'https://chatgpt\.com/backend-api/[a-z_/]*usage[a-z_/]*' "$(dirname "$(readlink -f "$(which codex)")")/.." 2>/dev/null | sort -u | head`
Expected: either a URL (write it down) or nothing. v1 ships log-based Codex either way. A found URL is only recorded in the spec as a future option.

- [ ] **Step 7: Append findings to the spec and commit**

Append to §2 of the spec:
```markdown
### Spike findings (2026-09-15)

- Claude usage URL: `<url that returned 200>`; headers: `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20`.
- `utilization` unit: <percent 0–100 | fraction 0–1>. `resets_at` format: <ISO string | epoch seconds>.
- Window keys observed: <e.g. five_hour, seven_day, seven_day_opus>.
- ChatGPT live usage call: <URL or "none found; Codex stays log-based">.
- Fixture: `src/main/providers/claude/fixtures/usage.json`.
```

```bash
git add scripts/spike/claude-usage.mjs src/main/providers/claude/fixtures/usage.json docs/superpowers/specs/2026-09-15-ai-usage-island-design.md
git commit -m "spike: confirm Claude usage endpoint and capture fixture"
```

---

### Task 1: Scaffold electron-vite + React + TypeScript + vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `electron.vite.config.ts`, `vitest.config.ts`, `src/test-setup.ts`
- Create: `src/shared/app-id.ts`, `src/shared/time.ts`, `src/shared/time.test.ts`
- Create: `src/main/index.ts` (temporary hello window, replaced in Task 11), `src/main/env.d.ts`, `src/preload/index.ts` (temporary, replaced in Task 11)
- Create: `src/renderer/island.html`, `src/renderer/island/main.tsx` (temporary)
- Create: `scripts/sync-to-windows.sh`

**Interfaces:**
- Produces: `APP_ID = 'com.rpbaguio.ai-usage'`, `PRODUCT_NAME = 'AI Usage'`, `MINUTE`, `HOUR`, `DAY`, `roundToMinute(ms: number): number`. Also the `npm test`, `npm run typecheck`, `npm run build` and `npm run dev` scripts.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ai-usage",
  "version": "0.1.0",
  "private": true,
  "description": "Notch-style island showing AI subscription plan usage limits",
  "author": "rpbaguio",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/make-icons.mjs",
    "dist": "electron-vite build && electron-builder --win"
  }
}
```

- [ ] **Step 2: Install pinned dependencies**

Run:
```bash
npm install --save-exact electron-log@5.4.4 koffi@3.3.0 zod@4.6.5
npm install --save-dev --save-exact electron@44.3.0 electron-vite@5.0.0 vite@7.3.6 @vitejs/plugin-react@5.2.0 \
  react@19.3.0 react-dom@19.3.0 lucide-react@1.46.0 typescript@5.9.3 @types/node@24.13.4 @types/react@19.3.0 @types/react-dom@19.3.0 \
  vitest@5.0.0 jsdom@30.0.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  electron-builder@26.15.3 sharp@0.35.4 png-to-ico@3.0.2
```
Expected: installs with no `ERESOLVE` peer errors. (`electron-vite@5` accepts Vite ≤ 7, which is why Vite is pinned to 7.3.6 and `@vitejs/plugin-react` to 5.2.0.)

- [ ] **Step 3: Create the TypeScript configs**

`tsconfig.json`:
```json
{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }] }
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts", "src/main/**/*", "src/preload/**/*", "src/shared/**/*", "src/test-setup.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": [],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 4: Create the build and test configs**

`electron.vite.config.ts`:
```ts
import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          island: resolve(__dirname, 'src/renderer/island.html'),
        },
      },
    },
  },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
});
```

`src/test-setup.ts`:
```ts
import { afterEach } from 'vitest';

// Component tests opt into jsdom per file; only those have a document to clean up.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
```

- [ ] **Step 5: Write the failing test for `time.ts`**

`src/shared/time.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, roundToMinute } from './time';

describe('time', () => {
  it('defines unit constants in ms', () => {
    expect(MINUTE).toBe(60_000);
    expect(HOUR).toBe(3_600_000);
    expect(DAY).toBe(86_400_000);
  });

  it('rounds to the nearest minute', () => {
    expect(roundToMinute(Date.UTC(2026, 8, 15, 19, 0, 29, 999))).toBe(Date.UTC(2026, 8, 15, 19, 0));
    expect(roundToMinute(Date.UTC(2026, 8, 15, 19, 0, 30))).toBe(Date.UTC(2026, 8, 15, 19, 1));
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/shared/time.test.ts`
Expected: FAIL with `Failed to resolve import "./time"`.

- [ ] **Step 7: Implement `time.ts` and `app-id.ts`**

`src/shared/time.ts`:
```ts
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function roundToMinute(ms: number): number {
  return Math.round(ms / MINUTE) * MINUTE;
}
```

`src/shared/app-id.ts`:
```ts
export const APP_ID = 'com.rpbaguio.ai-usage';
export const PRODUCT_NAME = 'AI Usage';
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/shared/time.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Create a temporary hello window to prove the build chain**

`src/main/env.d.ts`:
```ts
declare module '*?asset' {
  const path: string;
  export default path;
}
```

`src/main/index.ts` (temporary; Task 11 replaces it):
```ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 320,
    height: 120,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true },
  });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/island.html`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/island.html'));
  }
});
```

`src/preload/index.ts` (temporary; Task 11 replaces it):
```ts
export {};
```

`src/renderer/island.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    />
    <title>AI Usage</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/island/main.tsx"></script>
  </body>
</html>
```

`src/renderer/island/main.tsx` (temporary; Task 12 replaces it):
```tsx
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(<p>AI Usage scaffold</p>);
```

- [ ] **Step 10: Verify the typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: no type errors. The build writes `out/main/index.js`, `out/preload/index.js` and `out/renderer/island.html`.

- [ ] **Step 11: Add the WSL → Windows sync script**

`scripts/sync-to-windows.sh`:
```bash
#!/usr/bin/env bash
# Copy the WSL working tree to C:\dev\ai-usage so the app can run with Windows Node/Electron.
# node_modules is excluded on both sides: Windows keeps its own native builds.
set -euo pipefail
src="$(cd "$(dirname "$0")/.." && pwd)/"
dest="${AI_USAGE_WIN_DIR:-/mnt/c/dev/ai-usage}/"
mkdir -p "$dest"
rsync -a --delete \
  --exclude node_modules --exclude out --exclude dist --exclude .git --exclude .superpowers \
  "$src" "$dest"
echo "synced → $dest  (PowerShell: cd C:\\dev\\ai-usage; npm install; npm run dev)"
```
Run: `chmod +x scripts/sync-to-windows.sh && scripts/sync-to-windows.sh`
Expected: `synced → /mnt/c/dev/ai-usage/ ...`

- [ ] **Step 12: Smoke-run on Windows**

In PowerShell: `cd C:\dev\ai-usage; npm install; npm run dev`
Expected: a small window showing "AI Usage scaffold". Close it.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig*.json electron.vite.config.ts vitest.config.ts src scripts/sync-to-windows.sh
git commit -m "chore: scaffold electron-vite, React, TypeScript and vitest"
```

---
### Task 2: Shared domain types and settings schema

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/settings-schema.ts`
- Test: `src/shared/settings-schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  type ProviderStatus = 'ok' | 'stale' | 'auth-expired' | 'not-found' | 'error';
  type SourceKind = 'windows' | 'wsl';
  interface Source { kind: SourceKind; label: string; home: string }
  interface DetectedSource extends Source { lastModifiedMs: number }
  interface Limit { id: string; label: string; usedPercent: number | null; resetsAt: number | null }
  interface Snapshot { providerId: string; source: Source | null; plan?: string; status: ProviderStatus;
                       dataAsOf: number; limits: Limit[]; message?: string; retryAfterMs?: number }
  const SettingsSchema; type Settings; type ProviderSettings = { enabled: boolean; sourceHome: string | null };
  type SettingsPatch = Partial<Settings>;
  const DEFAULT_SETTINGS: Settings;
  function mergeSettings(current: Settings, patch: SettingsPatch): Settings;   // throws ZodError when invalid
  function providerSettings(settings: Settings, providerId: string): ProviderSettings;
  ```

- [ ] **Step 1: Create `src/shared/types.ts`**

```ts
export type ProviderStatus = 'ok' | 'stale' | 'auth-expired' | 'not-found' | 'error';

export type SourceKind = 'windows' | 'wsl';

/** A home folder that may contain a provider's CLI credentials or logs. */
export interface Source {
  kind: SourceKind;
  /** "Windows", "Local" (non-Windows dev) or "WSL · Ubuntu" */
  label: string;
  /** C:\Users\Raymond  or  \\wsl.localhost\Ubuntu\home\rpbaguio */
  home: string;
}

export interface DetectedSource extends Source {
  /** mtime of the provider's credential or newest log file; the newest wins by default */
  lastModifiedMs: number;
}

export interface Limit {
  id: string;
  label: string;
  /** 0–100, or null when the window has reset since the data was recorded */
  usedPercent: number | null;
  /** epoch ms rounded to the minute, or null when the provider gives no reset time */
  resetsAt: number | null;
}

export interface Snapshot {
  providerId: string;
  source: Source | null;
  plan?: string;
  status: ProviderStatus;
  /** epoch ms the numbers describe: fetch time for live calls, record time for logs */
  dataAsOf: number;
  limits: Limit[];
  message?: string;
  retryAfterMs?: number;
}
```

- [ ] **Step 2: Write the failing settings test**

`src/shared/settings-schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema, mergeSettings, providerSettings } from './settings-schema';

describe('settings schema', () => {
  it('fills every default from an empty object', () => {
    expect(SettingsSchema.parse({})).toEqual({
      providers: { claude: { enabled: true, sourceHome: null }, codex: { enabled: true, sourceHome: null } },
      displayId: null,
      warnPercent: 80,
      criticalPercent: 95,
      claudeRefreshMs: 120_000,
      alertsEnabled: true,
      hideInFullscreen: true,
      openAtLogin: true,
    });
    expect(DEFAULT_SETTINGS.warnPercent).toBe(80);
  });

  it('rejects a refresh interval under one minute', () => {
    expect(SettingsSchema.safeParse({ claudeRefreshMs: 30_000 }).success).toBe(false);
  });

  it('rejects warn >= critical', () => {
    expect(SettingsSchema.safeParse({ warnPercent: 95, criticalPercent: 95 }).success).toBe(false);
  });

  it('merges a patch and keeps untouched providers', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, {
      warnPercent: 70,
      providers: { ...DEFAULT_SETTINGS.providers, codex: { enabled: false, sourceHome: null } },
    });
    expect(next.warnPercent).toBe(70);
    expect(next.providers.claude).toEqual({ enabled: true, sourceHome: null });
    expect(next.providers.codex.enabled).toBe(false);
  });

  it('throws when a patch is invalid', () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, { criticalPercent: 50 })).toThrow();
  });

  it('returns enabled defaults for an unknown provider', () => {
    expect(providerSettings(DEFAULT_SETTINGS, 'gemini')).toEqual({ enabled: true, sourceHome: null });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/shared/settings-schema.test.ts`
Expected: FAIL with `Failed to resolve import "./settings-schema"`.

- [ ] **Step 4: Implement `src/shared/settings-schema.ts`**

```ts
import { z } from 'zod';

export const ProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Home folder chosen in Settings; null = pick the most recently modified source */
  sourceHome: z.string().nullable(),
});

export const SettingsSchema = z
  .object({
    providers: z
      .record(z.string(), ProviderSettingsSchema)
      .default({ claude: { enabled: true, sourceHome: null }, codex: { enabled: true, sourceHome: null } }),
    displayId: z.number().nullable().default(null),
    warnPercent: z.number().int().min(1).max(100).default(80),
    criticalPercent: z.number().int().min(1).max(100).default(95),
    claudeRefreshMs: z.number().int().min(60_000).default(120_000),
    alertsEnabled: z.boolean().default(true),
    hideInFullscreen: z.boolean().default(true),
    openAtLogin: z.boolean().default(true),
  })
  .refine((s) => s.warnPercent < s.criticalPercent, {
    message: 'Warning threshold must be below the critical threshold',
    path: ['warnPercent'],
  });

export type Settings = z.infer<typeof SettingsSchema>;
export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;
export type SettingsPatch = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  return SettingsSchema.parse({
    ...current,
    ...patch,
    providers: { ...current.providers, ...patch.providers },
  });
}

export function providerSettings(settings: Settings, providerId: string): ProviderSettings {
  return settings.providers[providerId] ?? { enabled: true, sourceHome: null };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/shared/settings-schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/settings-schema.ts src/shared/settings-schema.test.ts
git commit -m "feat: add shared snapshot types and settings schema"
```

---

### Task 3: Codex rate-limit parser and labels

**Files:**
- Create: `src/main/providers/codex/labels.ts`
- Create: `src/main/providers/codex/parse.ts`
- Test: `src/main/providers/codex/labels.test.ts`, `src/main/providers/codex/parse.test.ts`

**Interfaces:**
- Consumes: `Limit`, `Snapshot`, `Source` (Task 2); `roundToMinute` (Task 1).
- Produces:
  ```ts
  function windowLabel(minutes: number): string;
  function codexPlanLabel(planType: string | null | undefined): string | undefined;
  interface CodexWindow { usedPercent: number; windowMinutes: number; resetsAtSec: number | null }
  interface CodexRateLimitRecord { timestampMs: number; planType: string | null; primary: CodexWindow | null; secondary: CodexWindow | null }
  function findLastRateLimits(jsonl: string): CodexRateLimitRecord | null;
  function codexSnapshot(record: CodexRateLimitRecord, source: Source, now: number): Snapshot;
  ```

- [ ] **Step 1: Write the failing label tests**

`src/main/providers/codex/labels.test.ts`:
```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/providers/codex/labels.test.ts`
Expected: FAIL with `Failed to resolve import "./labels"`.

- [ ] **Step 3: Implement `labels.ts`**

```ts
export function windowLabel(minutes: number): string {
  if (minutes === 300) return '5-hour limit';
  if (minutes === 10080) return 'Weekly limit';
  if (minutes === 43200) return '30-day limit';
  if (minutes % 1440 === 0) return `${minutes / 1440}-day limit`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour limit`;
  return `${minutes}-minute limit`;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  prolite: 'Pro Lite',
  team: 'Team',
  business: 'Business',
  enterprise: 'Enterprise',
  edu: 'Edu',
};

export function codexPlanLabel(planType: string | null | undefined): string | undefined {
  if (!planType) return undefined;
  return PLAN_LABELS[planType] ?? planType.charAt(0).toUpperCase() + planType.slice(1);
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/providers/codex/labels.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Write the failing parser tests**

`src/main/providers/codex/parse.test.ts`. The record shape is copied from a real `~/.codex/sessions` log:
```ts
import { describe, expect, it } from 'vitest';
import { codexSnapshot, findLastRateLimits } from './parse';
import type { Source } from '../../../shared/types';

const source: Source = { kind: 'wsl', label: 'WSL · Ubuntu', home: '/home/me' };

function tokenCount(timestamp: string, rateLimits: unknown): string {
  return JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: { type: 'token_count', info: { total_token_usage: {} }, rate_limits: rateLimits },
  });
}

const weekly = {
  limit_id: 'codex',
  primary: { used_percent: 9.0, window_minutes: 10080, resets_at: 1789999200 },
  secondary: { used_percent: 41.0, window_minutes: 300, resets_at: 1789500000 },
  credits: { has_credits: false, unlimited: false, balance: '0' },
  plan_type: 'prolite',
};

describe('findLastRateLimits', () => {
  it('returns the last token_count record with rate limits', () => {
    const jsonl = [
      JSON.stringify({ timestamp: '2026-09-15T08:00:00.000Z', type: 'session_meta', payload: { id: 'x' } }),
      tokenCount('2026-09-15T08:01:00.000Z', { ...weekly, primary: { ...weekly.primary, used_percent: 5 } }),
      tokenCount('2026-09-15T08:02:00.000Z', weekly),
      tokenCount('2026-09-15T08:03:00.000Z', null),
      '',
    ].join('\n');

    expect(findLastRateLimits(jsonl)).toEqual({
      timestampMs: Date.parse('2026-09-15T08:02:00.000Z'),
      planType: 'prolite',
      primary: { usedPercent: 9, windowMinutes: 10080, resetsAtSec: 1789999200 },
      secondary: { usedPercent: 41, windowMinutes: 300, resetsAtSec: 1789500000 },
    });
  });

  it('skips a truncated first line from a tail read', () => {
    const jsonl = ['rate_limits": {"primary": {"used_perc', tokenCount('2026-09-15T08:02:00.000Z', weekly)].join('\n');
    expect(findLastRateLimits(jsonl)?.planType).toBe('prolite');
  });

  it('returns null when no record exists', () => {
    expect(findLastRateLimits('{"type":"session_meta"}\n')).toBeNull();
  });

  it('treats a missing secondary window as null', () => {
    const jsonl = tokenCount('2026-09-15T08:02:00.000Z', { ...weekly, secondary: null });
    expect(findLastRateLimits(jsonl)?.secondary).toBeNull();
  });
});

describe('codexSnapshot', () => {
  const record = findLastRateLimits(tokenCount('2026-09-15T08:02:00.000Z', weekly))!;

  it('builds labeled limits keyed by window size', () => {
    const now = 1789400000 * 1000;
    expect(codexSnapshot(record, source, now)).toEqual({
      providerId: 'codex',
      source,
      plan: 'Pro Lite',
      status: 'ok',
      dataAsOf: Date.parse('2026-09-15T08:02:00.000Z'),
      limits: [
        { id: 'codex-10080m', label: 'Weekly limit', usedPercent: 9, resetsAt: 1789999200 * 1000 },
        { id: 'codex-300m', label: '5-hour limit', usedPercent: 41, resetsAt: 1789500000 * 1000 },
      ],
    });
  });

  it('clears usedPercent for a window whose reset time has passed', () => {
    const now = 1789600000 * 1000; // after the 5-hour reset, before the weekly reset
    const limits = codexSnapshot(record, source, now).limits;
    expect(limits.find((l) => l.id === 'codex-300m')?.usedPercent).toBeNull();
    expect(limits.find((l) => l.id === 'codex-10080m')?.usedPercent).toBe(9);
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/main/providers/codex/parse.test.ts`
Expected: FAIL with `Failed to resolve import "./parse"`.

- [ ] **Step 7: Implement `parse.ts`**

```ts
import type { Limit, Snapshot, Source } from '../../../shared/types';
import { roundToMinute } from '../../../shared/time';
import { codexPlanLabel, windowLabel } from './labels';

export interface CodexWindow {
  usedPercent: number;
  windowMinutes: number;
  resetsAtSec: number | null;
}

export interface CodexRateLimitRecord {
  timestampMs: number;
  planType: string | null;
  primary: CodexWindow | null;
  secondary: CodexWindow | null;
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === 'object' ? (value as Json) : null;
}

function toWindow(value: unknown): CodexWindow | null {
  const w = asObject(value);
  if (!w || typeof w.used_percent !== 'number' || typeof w.window_minutes !== 'number') return null;
  return {
    usedPercent: w.used_percent,
    windowMinutes: w.window_minutes,
    resetsAtSec: typeof w.resets_at === 'number' ? w.resets_at : null,
  };
}

/** Scan a rollout .jsonl (or its tail) from the end for the newest rate-limit record. */
export function findLastRateLimits(jsonl: string): CodexRateLimitRecord | null {
  const lines = jsonl.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.includes('"rate_limits"')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue; // the first line of a tail read is usually cut off
    }
    const event = asObject(parsed);
    const payload = asObject(event?.payload);
    const rateLimits = asObject(payload?.rate_limits);
    if (payload?.type !== 'token_count' || !rateLimits) continue;
    const timestampMs = typeof event?.timestamp === 'string' ? Date.parse(event.timestamp) : NaN;
    if (Number.isNaN(timestampMs)) continue;
    return {
      timestampMs,
      planType: typeof rateLimits.plan_type === 'string' ? rateLimits.plan_type : null,
      primary: toWindow(rateLimits.primary),
      secondary: toWindow(rateLimits.secondary),
    };
  }
  return null;
}

export function codexSnapshot(record: CodexRateLimitRecord, source: Source, now: number): Snapshot {
  const limits: Limit[] = [];
  for (const window of [record.primary, record.secondary]) {
    if (!window) continue;
    const resetsAt = window.resetsAtSec === null ? null : roundToMinute(window.resetsAtSec * 1000);
    const hasReset = resetsAt !== null && resetsAt <= now;
    limits.push({
      id: `codex-${window.windowMinutes}m`,
      label: windowLabel(window.windowMinutes),
      usedPercent: hasReset ? null : window.usedPercent,
      resetsAt,
    });
  }
  return {
    providerId: 'codex',
    source,
    plan: codexPlanLabel(record.planType),
    status: 'ok',
    dataAsOf: record.timestampMs,
    limits,
  };
}
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/main/providers/codex`
Expected: PASS (all label and parser tests).

- [ ] **Step 9: Commit**

```bash
git add src/main/providers/codex
git commit -m "feat(codex): parse rate-limit records from rollout logs"
```

---
### Task 4: Provider plugin interface and Codex plugin

**Files:**
- Create: `src/main/providers/types.ts`
- Create: `src/main/providers/codex/find-latest-log.ts`
- Create: `src/main/providers/codex/plugin.ts`
- Test: `src/main/providers/codex/find-latest-log.test.ts`, `src/main/providers/codex/plugin.test.ts`

**Interfaces:**
- Consumes: `DetectedSource`, `Snapshot`, `Source` (Task 2); `Settings` (Task 2); `DAY` (Task 1); `findLastRateLimits`, `codexSnapshot`, `CodexRateLimitRecord` (Task 3).
- Produces:
  ```ts
  interface ProviderPlugin {
    id: string; name: string; shortName: string; usageUrl: string;
    fromLogs: boolean; staleAfterMs: number; notFoundMessage: string;
    intervalMs(settings: Settings): number;
    detectSources(candidates: Source[]): Promise<DetectedSource[]>;
    fetch(source: Source, now: number): Promise<Snapshot>;
  }
  interface LogFile { path: string; mtimeMs: number; size: number }
  function findLatestLogs(sessionsDir: string, maxDayDirs?: number, maxFiles?: number): Promise<LogFile[]>;
  function readTail(file: LogFile, maxBytes?: number): Promise<string>;
  function createCodexPlugin(): ProviderPlugin;   // id 'codex', name 'ChatGPT (Codex)', shortName 'Codex'
  ```

- [ ] **Step 1: Create `src/main/providers/types.ts`**

```ts
import type { Settings } from '../../shared/settings-schema';
import type { DetectedSource, Snapshot, Source } from '../../shared/types';

export interface ProviderPlugin {
  id: string;
  /** Panel group title, e.g. "ChatGPT (Codex)" */
  name: string;
  /** Pill label, e.g. "Codex" */
  shortName: string;
  /** Opened by the panel's arrow-up-right button */
  usageUrl: string;
  /** true when numbers come from local logs, so the footer shows their age */
  fromLogs: boolean;
  /** Numbers older than this are shown as stale */
  staleAfterMs: number;
  /** Message shown when no source has this provider's files */
  notFoundMessage: string;
  /** Delay between healthy runs */
  intervalMs(settings: Settings): number;
  /** Filter candidate homes down to those containing this provider's files */
  detectSources(candidates: Source[]): Promise<DetectedSource[]>;
  /** Read one source. Must not throw for expected failures; return a non-ok status instead. */
  fetch(source: Source, now: number): Promise<Snapshot>;
}
```

- [ ] **Step 2: Write the failing log-finder tests**

`src/main/providers/codex/find-latest-log.test.ts`:
```ts
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findLatestLogs, readTail } from './find-latest-log';

let root: string;

function writeLog(relDir: string, name: string, content: string, mtimeSec: number): string {
  const dir = join(root, relDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  utimesSync(path, mtimeSec, mtimeSec);
  return path;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'codex-sessions-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findLatestLogs', () => {
  it('returns rollout logs newest first across date folders', async () => {
    const older = writeLog('2026/08/31', 'rollout-a.jsonl', 'a', 1_000);
    const newest = writeLog('2026/09/15', 'rollout-b.jsonl', 'bb', 3_000);
    const middle = writeLog('2026/09/01', 'rollout-c.jsonl', 'c', 2_000);
    writeLog('2026/09/15', 'notes.txt', 'ignored', 9_000);

    const logs = await findLatestLogs(root);
    expect(logs.map((l) => l.path)).toEqual([newest, middle, older]);
    expect(logs[0]).toMatchObject({ mtimeMs: 3_000_000, size: 2 });
  });

  it('only scans the most recent day folders', async () => {
    writeLog('2026/09/14', 'rollout-old.jsonl', 'x', 5_000);
    const recent = writeLog('2026/09/15', 'rollout-new.jsonl', 'y', 4_000);
    expect((await findLatestLogs(root, 1)).map((l) => l.path)).toEqual([recent]);
  });

  it('caps the number of files', async () => {
    for (let i = 0; i < 7; i++) writeLog('2026/09/15', `rollout-${i}.jsonl`, 'z', 1_000 + i);
    expect(await findLatestLogs(root, 14, 5)).toHaveLength(5);
  });

  it('returns an empty list when the folder does not exist', async () => {
    expect(await findLatestLogs(join(root, 'missing'))).toEqual([]);
  });
});

describe('readTail', () => {
  it('reads only the last maxBytes of a file', async () => {
    const path = writeLog('2026/09/15', 'rollout-t.jsonl', 'first\nsecond\nthird\n', 1_000);
    const text = await readTail({ path, mtimeMs: 0, size: 19 }, 12);
    expect(text).toBe('econd\nthird\n');
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/main/providers/codex/find-latest-log.test.ts`
Expected: FAIL with `Failed to resolve import "./find-latest-log"`.

- [ ] **Step 4: Implement `find-latest-log.ts`**

```ts
import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface LogFile {
  path: string;
  mtimeMs: number;
  size: number;
}

async function numericDirsDesc(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => Number(b) - Number(a));
  } catch {
    return [];
  }
}

/** Newest `rollout-*.jsonl` files under <sessionsDir>/YYYY/MM/DD, looking at the last `maxDayDirs` day folders. */
export async function findLatestLogs(sessionsDir: string, maxDayDirs = 14, maxFiles = 5): Promise<LogFile[]> {
  const dayDirs: string[] = [];
  outer: for (const year of await numericDirsDesc(sessionsDir)) {
    for (const month of await numericDirsDesc(join(sessionsDir, year))) {
      for (const day of await numericDirsDesc(join(sessionsDir, year, month))) {
        dayDirs.push(join(sessionsDir, year, month, day));
        if (dayDirs.length >= maxDayDirs) break outer;
      }
    }
  }

  const files: LogFile[] = [];
  for (const dir of dayDirs) {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.startsWith('rollout-') || !name.endsWith('.jsonl')) continue;
      const path = join(dir, name);
      try {
        const s = await stat(path);
        files.push({ path, mtimeMs: s.mtimeMs, size: s.size });
      } catch {
        // deleted between readdir and stat
      }
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, maxFiles);
}

const DEFAULT_TAIL_BYTES = 1024 * 1024;

export async function readTail(file: LogFile, maxBytes = DEFAULT_TAIL_BYTES): Promise<string> {
  const handle = await open(file.path, 'r');
  try {
    const length = Math.min(file.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, file.size - length);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run src/main/providers/codex/find-latest-log.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing plugin tests**

`src/main/providers/codex/plugin.test.ts`:
```ts
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/settings-schema';
import type { Source } from '../../../shared/types';
import { createCodexPlugin } from './plugin';

let home: string;
let source: Source;

function writeRollout(day: string, name: string, usedPercent: number, mtimeSec: number): void {
  const dir = join(home, '.codex', 'sessions', ...day.split('/'));
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    timestamp: '2026-09-15T08:02:00.000Z',
    type: 'event_msg',
    payload: {
      type: 'token_count',
      rate_limits: { primary: { used_percent: usedPercent, window_minutes: 10080, resets_at: 1789999200 }, secondary: null, plan_type: 'plus' },
    },
  });
  const path = join(dir, name);
  writeFileSync(path, `${line}\n`);
  utimesSync(path, mtimeSec, mtimeSec);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'codex-home-'));
  source = { kind: 'windows', label: 'Local', home };
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('createCodexPlugin', () => {
  const now = Date.parse('2026-09-15T09:00:00.000Z');

  it('describes itself', () => {
    const plugin = createCodexPlugin();
    expect(plugin).toMatchObject({ id: 'codex', name: 'ChatGPT (Codex)', shortName: 'Codex', fromLogs: true, staleAfterMs: 86_400_000 });
    expect(plugin.intervalMs(DEFAULT_SETTINGS)).toBe(30_000);
  });

  it('detects homes that have rollout logs', async () => {
    writeRollout('2026/09/15', 'rollout-1.jsonl', 10, 5_000);
    const empty: Source = { kind: 'wsl', label: 'WSL · Other', home: join(home, 'nobody') };
    const detected = await createCodexPlugin().detectSources([source, empty]);
    expect(detected).toEqual([{ ...source, lastModifiedMs: 5_000_000 }]);
  });

  it('returns an ok snapshot from the newest log', async () => {
    writeRollout('2026/09/14', 'rollout-old.jsonl', 5, 1_000);
    writeRollout('2026/09/15', 'rollout-new.jsonl', 42, 2_000);
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot).toMatchObject({ providerId: 'codex', status: 'ok', plan: 'Plus' });
    expect(snapshot.limits).toEqual([{ id: 'codex-10080m', label: 'Weekly limit', usedPercent: 42, resetsAt: 1789999200 * 1000 }]);
  });

  it('falls back to an older log when the newest has no rate limits yet', async () => {
    writeRollout('2026/09/14', 'rollout-old.jsonl', 7, 1_000);
    const dir = join(home, '.codex', 'sessions', '2026', '09', '15');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rollout-new.jsonl'), '{"type":"session_meta","payload":{}}\n');
    utimesSync(join(dir, 'rollout-new.jsonl'), 2_000, 2_000);
    expect((await createCodexPlugin().fetch(source, now)).limits[0].usedPercent).toBe(7);
  });

  it('returns not-found when there are no logs', async () => {
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot).toMatchObject({ providerId: 'codex', status: 'not-found', limits: [], message: 'No Codex logs in Local' });
  });

  it('reuses the parsed record while the newest log is unchanged', async () => {
    writeRollout('2026/09/15', 'rollout-new.jsonl', 42, 2_000);
    const plugin = createCodexPlugin();
    await plugin.fetch(source, now);
    // Rewrite the content but restore the same mtime: a cached read must not notice.
    writeRollout('2026/09/15', 'rollout-new.jsonl', 99, 2_000);
    expect((await plugin.fetch(source, now)).limits[0].usedPercent).toBe(42);
  });
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `npx vitest run src/main/providers/codex/plugin.test.ts`
Expected: FAIL with `Failed to resolve import "./plugin"`.

- [ ] **Step 8: Implement `plugin.ts`**

```ts
import { join } from 'node:path';
import { DAY } from '../../../shared/time';
import type { DetectedSource, Snapshot, Source } from '../../../shared/types';
import type { ProviderPlugin } from '../types';
import { findLatestLogs, readTail } from './find-latest-log';
import { codexSnapshot, findLastRateLimits, type CodexRateLimitRecord } from './parse';

function sessionsDir(home: string): string {
  return join(home, '.codex', 'sessions');
}

export function createCodexPlugin(): ProviderPlugin {
  // Logs only change while Codex runs, so re-parse only when the newest log's path or mtime changes.
  let cache: { key: string; record: CodexRateLimitRecord } | null = null;

  const notFound = (source: Source, now: number, message: string): Snapshot => ({
    providerId: 'codex',
    source,
    status: 'not-found',
    dataAsOf: now,
    limits: [],
    message,
  });

  return {
    id: 'codex',
    name: 'ChatGPT (Codex)',
    shortName: 'Codex',
    usageUrl: 'https://chatgpt.com/codex/settings/usage',
    fromLogs: true,
    staleAfterMs: DAY,
    notFoundMessage: 'No Codex logs found on Windows or running WSL distros',
    intervalMs: () => 30_000,

    async detectSources(candidates) {
      const found: DetectedSource[] = [];
      for (const candidate of candidates) {
        const [latest] = await findLatestLogs(sessionsDir(candidate.home), 14, 1);
        if (latest) found.push({ ...candidate, lastModifiedMs: latest.mtimeMs });
      }
      return found;
    },

    async fetch(source, now) {
      const logs = await findLatestLogs(sessionsDir(source.home));
      if (logs.length === 0) return notFound(source, now, `No Codex logs in ${source.label}`);

      const key = `${logs[0].path}|${logs[0].mtimeMs}`;
      if (cache?.key === key) return codexSnapshot(cache.record, source, now);

      for (const log of logs) {
        const record = findLastRateLimits(await readTail(log));
        if (record) {
          cache = { key, record };
          return codexSnapshot(record, source, now);
        }
      }
      return notFound(source, now, `No Codex usage recorded yet in ${source.label}`);
    },
  };
}
```

- [ ] **Step 9: Run them to verify they pass**

Run: `npx vitest run src/main/providers/codex`
Expected: PASS (all Codex tests).

- [ ] **Step 10: Commit**

```bash
git add src/main/providers/types.ts src/main/providers/codex
git commit -m "feat(codex): add provider plugin reading newest rollout logs"
```

---
### Task 5: Claude plugin (credentials, usage parser, plan label)

**Files:**
- Create: `src/main/providers/claude/plan-label.ts`
- Create: `src/main/providers/claude/credentials.ts`
- Create: `src/main/providers/claude/parse.ts`
- Create: `src/main/providers/claude/plugin.ts`
- Test: `src/main/providers/claude/plan-label.test.ts`, `credentials.test.ts`, `parse.test.ts`, `plugin.test.ts` (all in the same folder)

**Interfaces:**
- Consumes: `ProviderPlugin` (Task 4); `Limit`, `Snapshot`, `Source`, `DetectedSource` (Task 2); `MINUTE`, `roundToMinute` (Task 1). Also `fixtures/usage.json` and the spike findings from Task 0.
- Produces:
  ```ts
  function claudePlanLabel(subscriptionType?: string | null, rateLimitTier?: string | null): string | undefined;
  interface ClaudeCredentials { accessToken: string; expiresAt: number; subscriptionType?: string; rateLimitTier?: string }
  function parseClaudeCredentials(text: string): ClaudeCredentials | null;
  function credentialsPath(home: string): string;
  function parseResetsAt(value: unknown): number | null;
  function limitLabel(key: string): string;
  function parseClaudeUsage(body: unknown): Limit[];   // throws on a non-object body
  const CLAUDE_USAGE_URL: string;
  type HttpGet = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;
  interface HttpResponse { status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }
  function parseRetryAfter(value: string | null, now: number): number | undefined;
  function createClaudePlugin(deps?: { httpGet?: HttpGet; readFile?: (path: string) => Promise<string>; statMtimeMs?: (path: string) => Promise<number> }): ProviderPlugin;
  ```

- [ ] **Step 1: Write the failing plan-label and credentials tests**

`src/main/providers/claude/plan-label.test.ts`:
```ts
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
```

`src/main/providers/claude/credentials.test.ts`:
```ts
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
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/providers/claude/plan-label.test.ts src/main/providers/claude/credentials.test.ts`
Expected: FAIL with `Failed to resolve import`.

- [ ] **Step 3: Implement `plan-label.ts` and `credentials.ts`**

`src/main/providers/claude/plan-label.ts`:
```ts
export function claudePlanLabel(subscriptionType?: string | null, rateLimitTier?: string | null): string | undefined {
  if (!subscriptionType) return undefined;
  const base = subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1);
  const multiplier = rateLimitTier?.match(/_(\d+x)$/)?.[1];
  return multiplier ? `${base} (${multiplier})` : base;
}
```

`src/main/providers/claude/credentials.ts`:
```ts
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
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/providers/claude/plan-label.test.ts src/main/providers/claude/credentials.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing usage-parser tests**

`src/main/providers/claude/parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/usage.json';
import { limitLabel, parseClaudeUsage, parseResetsAt } from './parse';

describe('parseResetsAt', () => {
  it('parses ISO strings with microseconds and rounds to the minute', () => {
    expect(parseResetsAt('2026-09-15T19:00:12.123456+00:00')).toBe(Date.UTC(2026, 8, 15, 19, 0));
  });

  it('returns null for missing or invalid values', () => {
    expect(parseResetsAt(null)).toBeNull();
    expect(parseResetsAt('soon')).toBeNull();
  });
});

describe('limitLabel', () => {
  it.each([
    ['five_hour', '5-hour limit'],
    ['seven_day', 'Weekly · all models'],
    ['seven_day_opus', 'Weekly · Opus'],
    ['seven_day_oauth_apps', 'Weekly · Oauth Apps'],
    ['monthly_thing', 'Monthly Thing'],
  ])('%s → %s', (key, label) => {
    expect(limitLabel(key)).toBe(label);
  });
});

describe('parseClaudeUsage', () => {
  it('maps windows in display order and skips non-window keys', () => {
    const limits = parseClaudeUsage({
      seven_day_opus: { utilization: 14, resets_at: '2026-09-21T13:00:00.000000+00:00' },
      extra_usage: { is_enabled: false, utilization: 3 },
      seven_day: { utilization: 29, resets_at: '2026-09-21T13:00:00.000000+00:00' },
      seven_day_sonnet: null,
      five_hour: { utilization: 73, resets_at: '2026-09-15T19:00:00.000000+00:00' },
    });
    expect(limits).toEqual([
      { id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: Date.UTC(2026, 8, 15, 19, 0) },
      { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: Date.UTC(2026, 8, 21, 13, 0) },
      { id: 'seven_day_opus', label: 'Weekly · Opus', usedPercent: 14, resetsAt: Date.UTC(2026, 8, 21, 13, 0) },
    ]);
  });

  it('keeps a window with a null reset time', () => {
    expect(parseClaudeUsage({ five_hour: { utilization: 0, resets_at: null } })).toEqual([
      { id: 'five_hour', label: '5-hour limit', usedPercent: 0, resetsAt: null },
    ]);
  });

  it('throws on a non-object body', () => {
    expect(() => parseClaudeUsage('nope')).toThrow('Unexpected usage response');
  });

  it('parses the captured fixture from the spike', () => {
    const limits = parseClaudeUsage(fixture);
    expect(limits.map((l) => l.id)).toContain('five_hour');
    expect(limits.map((l) => l.id)).toContain('seven_day');
    for (const limit of limits) {
      expect(limit.usedPercent).toBeGreaterThanOrEqual(0);
      expect(limit.usedPercent).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/main/providers/claude/parse.test.ts`
Expected: FAIL with `Failed to resolve import "./parse"`.

- [ ] **Step 7: Implement `parse.ts`**

**Adjustment point:** if Task 0 found that `utilization` is a 0–1 fraction, multiply by 100 where marked. If `resets_at` is epoch seconds, change `parseResetsAt` to `typeof value === 'number' ? roundToMinute(value * 1000) : null`, and update the tests to match.

```ts
import { roundToMinute } from '../../../shared/time';
import type { Limit } from '../../../shared/types';

export function parseResetsAt(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  // Python-style timestamps carry 6 fractional digits; trim to 3 so Date.parse accepts them everywhere.
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(ms) ? null : roundToMinute(ms);
}

function titleCase(snake: string): string {
  return snake
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function limitLabel(key: string): string {
  if (key === 'five_hour') return '5-hour limit';
  if (key === 'seven_day') return 'Weekly · all models';
  if (key.startsWith('seven_day_')) return `Weekly · ${titleCase(key.slice('seven_day_'.length))}`;
  return titleCase(key);
}

const DISPLAY_ORDER = ['five_hour', 'seven_day'];

function rank(id: string): number {
  const index = DISPLAY_ORDER.indexOf(id);
  return index === -1 ? DISPLAY_ORDER.length : index;
}

export function parseClaudeUsage(body: unknown): Limit[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Unexpected usage response');
  const limits: Limit[] = [];
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const window = value as Record<string, unknown>;
    // A rate-limit window has both fields; blocks like extra_usage do not.
    if (typeof window.utilization !== 'number' || !('resets_at' in window)) continue;
    limits.push({
      id: key,
      label: limitLabel(key),
      usedPercent: window.utilization, // adjustment point: `* 100` if the spike found a 0–1 fraction
      resetsAt: parseResetsAt(window.resets_at),
    });
  }
  return limits.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/main/providers/claude/parse.test.ts`
Expected: PASS (all parser tests, including the fixture test).

- [ ] **Step 9: Write the failing plugin tests**

`src/main/providers/claude/plugin.test.ts`:
```ts
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
```

- [ ] **Step 10: Run them to verify they fail**

Run: `npx vitest run src/main/providers/claude/plugin.test.ts`
Expected: FAIL with `Failed to resolve import "./plugin"`.

- [ ] **Step 11: Implement `plugin.ts`**

Use the URL and headers confirmed in Task 0 if they differ from these:
```ts
import { readFile as fsReadFile, stat } from 'node:fs/promises';
import { MINUTE } from '../../../shared/time';
import type { DetectedSource, Snapshot } from '../../../shared/types';
import type { ProviderPlugin } from '../types';
import { credentialsPath, parseClaudeCredentials } from './credentials';
import { parseClaudeUsage } from './parse';
import { claudePlanLabel } from './plan-label';

export const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const CLAUDE_USAGE_HEADERS = { 'anthropic-beta': 'oauth-2025-04-20' };

export interface HttpResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type HttpGet = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;

const defaultHttpGet: HttpGet = (url, headers) => fetch(url, { headers, signal: AbortSignal.timeout(15_000) });

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
}

export function createClaudePlugin(deps: ClaudePluginDeps = {}): ProviderPlugin {
  const httpGet = deps.httpGet ?? defaultHttpGet;
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
        res = await httpGet(CLAUDE_USAGE_URL, { ...CLAUDE_USAGE_HEADERS, Authorization: `Bearer ${creds.accessToken}` });
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
```

- [ ] **Step 12: Run all Claude tests and the typecheck**

Run: `npx vitest run src/main/providers/claude && npm run typecheck`
Expected: PASS; no type errors. (`resolveJsonModule` in `tsconfig.node.json` covers the fixture import.)

- [ ] **Step 13: Commit**

```bash
git add src/main/providers/claude
git commit -m "feat(claude): add provider plugin using Claude Code OAuth usage"
```

---
### Task 6: Source detection (Windows home + running WSL distros)

**Files:**
- Create: `src/main/sources/detect.ts`
- Test: `src/main/sources/detect.test.ts`

**Interfaces:**
- Consumes: `Source`, `DetectedSource` (Task 2).
- Produces:
  ```ts
  function parseWslList(output: Buffer): string[];
  interface DetectDeps { platform: NodeJS.Platform; homedir(): string; listRunningDistros(): Promise<Buffer>; readdir(path: string): Promise<string[]>; timeoutMs?: number }
  function listCandidateHomes(deps: DetectDeps): Promise<Source[]>;
  function pickSource(detected: DetectedSource[], preferredHome: string | null): DetectedSource | null;
  function defaultDetectDeps(): DetectDeps;
  ```

- [ ] **Step 1: Write the failing tests**

`src/main/sources/detect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { DetectedSource } from '../../shared/types';
import { listCandidateHomes, parseWslList, pickSource, type DetectDeps } from './detect';

const utf16 = (text: string) => Buffer.from(`\uFEFF${text}`, 'utf16le');

function deps(overrides: Partial<DetectDeps>): DetectDeps {
  return {
    platform: 'win32',
    homedir: () => 'C:\\Users\\Raymond',
    listRunningDistros: async () => utf16('Ubuntu\r\nDebian\r\n'),
    readdir: async (path) => (path.includes('Ubuntu') ? ['rpbaguio'] : ['root2', 'dev']),
    timeoutMs: 50,
    ...overrides,
  };
}

describe('parseWslList', () => {
  it('decodes UTF-16LE output and drops the BOM and blank lines', () => {
    expect(parseWslList(utf16('Ubuntu\r\n\r\nDebian-12\r\n'))).toEqual(['Ubuntu', 'Debian-12']);
  });

  it('ignores the "no running distributions" sentence', () => {
    expect(parseWslList(utf16('There are no running distributions.\r\n'))).toEqual([]);
  });
});

describe('listCandidateHomes', () => {
  it('lists the Windows home and every user home in running distros', async () => {
    expect(await listCandidateHomes(deps({}))).toEqual([
      { kind: 'windows', label: 'Windows', home: 'C:\\Users\\Raymond' },
      { kind: 'wsl', label: 'WSL · Ubuntu', home: '\\\\wsl.localhost\\Ubuntu\\home\\rpbaguio' },
      { kind: 'wsl', label: 'WSL · Debian', home: '\\\\wsl.localhost\\Debian\\home\\root2' },
      { kind: 'wsl', label: 'WSL · Debian', home: '\\\\wsl.localhost\\Debian\\home\\dev' },
    ]);
  });

  it('only returns the local home on non-Windows platforms', async () => {
    expect(await listCandidateHomes(deps({ platform: 'linux', homedir: () => '/home/me' }))).toEqual([
      { kind: 'windows', label: 'Local', home: '/home/me' },
    ]);
  });

  it('survives wsl.exe failing or hanging', async () => {
    const failing = await listCandidateHomes(deps({ listRunningDistros: async () => Promise.reject(new Error('no wsl')) }));
    expect(failing).toHaveLength(1);
    const hanging = await listCandidateHomes(deps({ listRunningDistros: () => new Promise(() => {}) }));
    expect(hanging).toHaveLength(1);
  });

  it('skips a distro whose home folder cannot be read in time', async () => {
    const result = await listCandidateHomes(
      deps({ readdir: (path) => (path.includes('Ubuntu') ? new Promise(() => {}) : Promise.resolve(['dev'])) }),
    );
    expect(result.map((s) => s.home)).toEqual(['C:\\Users\\Raymond', '\\\\wsl.localhost\\Debian\\home\\dev']);
  });
});

describe('pickSource', () => {
  const windows: DetectedSource = { kind: 'windows', label: 'Windows', home: 'C:\\Users\\Raymond', lastModifiedMs: 100 };
  const wsl: DetectedSource = { kind: 'wsl', label: 'WSL · Ubuntu', home: '\\\\wsl.localhost\\Ubuntu\\home\\rpbaguio', lastModifiedMs: 200 };

  it('prefers the configured home when it is still detected', () => {
    expect(pickSource([windows, wsl], windows.home)).toBe(windows);
  });

  it('falls back to the most recently modified source', () => {
    expect(pickSource([windows, wsl], null)).toBe(wsl);
    expect(pickSource([windows, wsl], 'D:\\gone')).toBe(wsl);
  });

  it('returns null when nothing is detected', () => {
    expect(pickSource([], null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/sources/detect.test.ts`
Expected: FAIL with `Failed to resolve import "./detect"`.

- [ ] **Step 3: Implement `detect.ts`**

```ts
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { DetectedSource, Source } from '../../shared/types';

export interface DetectDeps {
  platform: NodeJS.Platform;
  homedir(): string;
  listRunningDistros(): Promise<Buffer>;
  readdir(path: string): Promise<string[]>;
  timeoutMs?: number;
}

/** `wsl.exe -l --running -q` prints UTF-16LE; distro names never contain spaces, sentences do. */
export function parseWslList(output: Buffer): string[] {
  return output
    .toString('utf16le')
    .replace(/^\uFEFF/, '')
    .replace(/\0/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[\w.-]+$/.test(line));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function listCandidateHomes(deps: DetectDeps): Promise<Source[]> {
  const isWindows = deps.platform === 'win32';
  const sources: Source[] = [{ kind: 'windows', label: isWindows ? 'Windows' : 'Local', home: deps.homedir() }];
  if (!isWindows) return sources;

  const timeoutMs = deps.timeoutMs ?? 3000;
  // Only running distros: touching \\wsl.localhost\<distro> would boot a stopped one.
  const distros = parseWslList(await withTimeout(deps.listRunningDistros(), timeoutMs, Buffer.alloc(0)));
  for (const distro of distros) {
    const homeRoot = `\\\\wsl.localhost\\${distro}\\home`;
    const users = await withTimeout(deps.readdir(homeRoot), timeoutMs, [] as string[]);
    for (const user of users) {
      sources.push({ kind: 'wsl', label: `WSL · ${distro}`, home: `${homeRoot}\\${user}` });
    }
  }
  return sources;
}

export function pickSource(detected: DetectedSource[], preferredHome: string | null): DetectedSource | null {
  if (preferredHome) {
    const preferred = detected.find((source) => source.home === preferredHome);
    if (preferred) return preferred;
  }
  return detected.reduce<DetectedSource | null>(
    (best, source) => (best === null || source.lastModifiedMs > best.lastModifiedMs ? source : best),
    null,
  );
}

export function defaultDetectDeps(): DetectDeps {
  return {
    platform: process.platform,
    homedir,
    listRunningDistros: () =>
      new Promise((resolve, reject) => {
        execFile('wsl.exe', ['-l', '--running', '-q'], { encoding: 'buffer', windowsHide: true }, (error, stdout) =>
          error ? reject(error) : resolve(stdout),
        );
      }),
    readdir: (path) => readdir(path),
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/sources/detect.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/sources
git commit -m "feat: detect Windows and running WSL home folders"
```

---

### Task 7: Settings and state persistence

**Files:**
- Create: `src/main/json-file.ts`
- Create: `src/main/settings.ts`
- Create: `src/main/state-file.ts`
- Test: `src/main/settings.test.ts`, `src/main/state-file.test.ts`

**Interfaces:**
- Consumes: `SettingsSchema`, `Settings`, `DEFAULT_SETTINGS` (Task 2); `Snapshot` (Task 2).
- Produces:
  ```ts
  function readJson(file: string): unknown | undefined;      // undefined when missing; throws on corrupt JSON
  function writeJsonAtomic(file: string, data: unknown): void;
  function loadSettings(file: string): Settings;             // corrupt/invalid → DEFAULT_SETTINGS + <file>.bak copy
  function saveSettings(file: string, settings: Settings): void;
  interface PersistedState { lastGood: Record<string, Snapshot>; alertsFired: string[] }
  function loadState(file: string): PersistedState;
  function saveState(file: string, state: PersistedState): void;
  ```

- [ ] **Step 1: Write the failing tests**

`src/main/settings.test.ts`:
```ts
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/settings-schema';
import { loadSettings, saveSettings } from './settings';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'settings-'));
  file = join(dir, 'nested', 'settings.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('settings persistence', () => {
  it('returns defaults when the file does not exist', () => {
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings, creating folders', () => {
    const settings = { ...DEFAULT_SETTINGS, warnPercent: 70, displayId: 42 };
    saveSettings(file, settings);
    expect(loadSettings(file)).toEqual(settings);
  });

  it('backs up corrupt JSON and returns defaults', () => {
    saveSettings(file, DEFAULT_SETTINGS);
    writeFileSync(file, '{ not json');
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{ not json');
  });

  it('backs up schema-invalid settings and returns defaults', () => {
    saveSettings(file, DEFAULT_SETTINGS);
    writeFileSync(file, JSON.stringify({ claudeRefreshMs: 5 }));
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
    expect(existsSync(`${file}.bak`)).toBe(true);
  });
});
```

`src/main/state-file.test.ts`:
```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Snapshot } from '../shared/types';
import { loadState, saveState } from './state-file';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'state-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const snapshot: Snapshot = {
  providerId: 'claude',
  source: { kind: 'windows', label: 'Windows', home: 'C:\\Users\\Raymond' },
  plan: 'Max (5x)',
  status: 'ok',
  dataAsOf: 1,
  limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: 2 }],
};

describe('state file', () => {
  it('returns an empty state when missing or corrupt', () => {
    const file = join(dir, 'state.json');
    expect(loadState(file)).toEqual({ lastGood: {}, alertsFired: [] });
    writeFileSync(file, 'garbage');
    expect(loadState(file)).toEqual({ lastGood: {}, alertsFired: [] });
  });

  it('round-trips snapshots and fired alert keys', () => {
    const file = join(dir, 'state.json');
    saveState(file, { lastGood: { claude: snapshot }, alertsFired: ['threshold|claude|five_hour|2|80'] });
    expect(loadState(file)).toEqual({ lastGood: { claude: snapshot }, alertsFired: ['threshold|claude|five_hour|2|80'] });
    expect(readFileSync(file, 'utf8')).not.toMatch(/token/i);
  });

  it('drops malformed fields', () => {
    const file = join(dir, 'state.json');
    writeFileSync(file, JSON.stringify({ lastGood: 'x', alertsFired: ['ok', 3] }));
    expect(loadState(file)).toEqual({ lastGood: {}, alertsFired: ['ok'] });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/settings.test.ts src/main/state-file.test.ts`
Expected: FAIL with `Failed to resolve import`.

- [ ] **Step 3: Implement `json-file.ts`, `settings.ts`, `state-file.ts`**

`src/main/json-file.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** undefined when the file is missing; throws SyntaxError when it is not valid JSON. */
export function readJson(file: string): unknown | undefined {
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJsonAtomic(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2));
  renameSync(temp, file);
}
```

`src/main/settings.ts`:
```ts
import { copyFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '../shared/settings-schema';
import { readJson, writeJsonAtomic } from './json-file';

function backup(file: string): void {
  try {
    copyFileSync(file, `${file}.bak`);
  } catch {
    // nothing to back up
  }
}

export function loadSettings(file: string): Settings {
  let raw: unknown;
  try {
    raw = readJson(file);
  } catch {
    backup(file);
    return DEFAULT_SETTINGS;
  }
  if (raw === undefined) return DEFAULT_SETTINGS;
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    backup(file);
    return DEFAULT_SETTINGS;
  }
  return parsed.data;
}

export function saveSettings(file: string, settings: Settings): void {
  writeJsonAtomic(file, SettingsSchema.parse(settings));
}
```

`src/main/state-file.ts`:
```ts
import type { Snapshot } from '../shared/types';
import { readJson, writeJsonAtomic } from './json-file';

export interface PersistedState {
  /** Last ok snapshot per provider, so the panel has numbers at launch. Never contains tokens. */
  lastGood: Record<string, Snapshot>;
  alertsFired: string[];
}

const EMPTY: PersistedState = { lastGood: {}, alertsFired: [] };

export function loadState(file: string): PersistedState {
  let raw: unknown;
  try {
    raw = readJson(file);
  } catch {
    return { ...EMPTY };
  }
  const state = (raw ?? {}) as { lastGood?: unknown; alertsFired?: unknown };
  return {
    lastGood:
      state.lastGood && typeof state.lastGood === 'object' && !Array.isArray(state.lastGood)
        ? (state.lastGood as Record<string, Snapshot>)
        : {},
    alertsFired: Array.isArray(state.alertsFired) ? state.alertsFired.filter((k): k is string => typeof k === 'string') : [],
  };
}

export function saveState(file: string, state: PersistedState): void {
  writeJsonAtomic(file, state);
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/settings.test.ts src/main/state-file.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/json-file.ts src/main/settings.ts src/main/state-file.ts src/main/settings.test.ts src/main/state-file.test.ts
git commit -m "feat: persist settings and last-good state as JSON"
```

---
### Task 8: Usage store and scheduler

**Files:**
- Create: `src/main/usage-store.ts`
- Create: `src/main/scheduler.ts`
- Test: `src/main/usage-store.test.ts`, `src/main/scheduler.test.ts`

**Interfaces:**
- Consumes: `Snapshot` (Task 2).
- Produces:
  ```ts
  interface StoreEntry { latest: Snapshot; lastGood?: Snapshot; nextRunAt?: number }
  class UsageStore {
    constructor(lastGood?: Record<string, Snapshot>);
    update(snapshot: Snapshot, nextRunAt?: number): { previous?: StoreEntry; entry: StoreEntry };
    get(providerId: string): StoreEntry | undefined;
    lastGoodMap(): Record<string, Snapshot>;
  }
  const RETRY_STEPS_MS: readonly number[];   // [60000, 120000, 300000, 600000]
  function nextDelayMs(consecutiveErrors: number, intervalMs: number, retryAfterMs?: number): number;
  interface ScheduledTask { id: string; intervalMs(): number; run(): Promise<Snapshot> }
  class Scheduler {
    constructor(tasks: ScheduledTask[], onSnapshot: (snapshot: Snapshot, nextRunAt: number) => void, now?: () => number);
    start(): void; stop(): void;
    setTasks(tasks: ScheduledTask[]): void;
    refreshNow(options?: { olderThanMs?: number }): Promise<void>;
  }
  ```

- [ ] **Step 1: Write the failing store tests**

`src/main/usage-store.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../shared/types';
import { UsageStore } from './usage-store';

const ok = (dataAsOf: number): Snapshot => ({
  providerId: 'claude',
  source: null,
  status: 'ok',
  dataAsOf,
  limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent: dataAsOf, resetsAt: null }],
});
const failed: Snapshot = { providerId: 'claude', source: null, status: 'error', dataAsOf: 99, limits: [], message: 'offline' };

describe('UsageStore', () => {
  it('keeps the last ok snapshot when a later fetch fails', () => {
    const store = new UsageStore();
    store.update(ok(10));
    const { previous, entry } = store.update(failed, 5_000);
    expect(previous?.latest.dataAsOf).toBe(10);
    expect(entry).toEqual({ latest: failed, lastGood: ok(10), nextRunAt: 5_000 });
  });

  it('seeds entries from persisted last-good snapshots', () => {
    const store = new UsageStore({ claude: ok(7) });
    expect(store.get('claude')).toEqual({ latest: ok(7), lastGood: ok(7) });
    expect(store.lastGoodMap()).toEqual({ claude: ok(7) });
  });

  it('returns undefined for unknown providers', () => {
    expect(new UsageStore().get('codex')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/usage-store.test.ts`
Expected: FAIL with `Failed to resolve import "./usage-store"`.

- [ ] **Step 3: Implement `usage-store.ts`**

```ts
import type { Snapshot } from '../shared/types';

export interface StoreEntry {
  latest: Snapshot;
  lastGood?: Snapshot;
  /** When the scheduler will run this provider next (shown as "retrying in …") */
  nextRunAt?: number;
}

export class UsageStore {
  private readonly entries = new Map<string, StoreEntry>();

  constructor(lastGood: Record<string, Snapshot> = {}) {
    for (const [id, snapshot] of Object.entries(lastGood)) {
      this.entries.set(id, { latest: snapshot, lastGood: snapshot });
    }
  }

  update(snapshot: Snapshot, nextRunAt?: number): { previous?: StoreEntry; entry: StoreEntry } {
    const previous = this.entries.get(snapshot.providerId);
    const entry: StoreEntry = {
      latest: snapshot,
      lastGood: snapshot.status === 'ok' ? snapshot : previous?.lastGood,
      ...(nextRunAt === undefined ? {} : { nextRunAt }),
    };
    this.entries.set(snapshot.providerId, entry);
    return { previous, entry };
  }

  get(providerId: string): StoreEntry | undefined {
    return this.entries.get(providerId);
  }

  lastGoodMap(): Record<string, Snapshot> {
    const map: Record<string, Snapshot> = {};
    for (const [id, entry] of this.entries) if (entry.lastGood) map[id] = entry.lastGood;
    return map;
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/usage-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing scheduler tests**

`src/main/scheduler.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../shared/types';
import { Scheduler, nextDelayMs, type ScheduledTask } from './scheduler';

const snap = (status: Snapshot['status'], extra: Partial<Snapshot> = {}): Snapshot => ({
  providerId: 'claude',
  source: null,
  status,
  dataAsOf: Date.now(),
  limits: [],
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nextDelayMs', () => {
  it('uses the interval when healthy and backs off after errors', () => {
    expect(nextDelayMs(0, 120_000)).toBe(120_000);
    expect(nextDelayMs(1, 120_000)).toBe(60_000);
    expect(nextDelayMs(2, 120_000)).toBe(120_000);
    expect(nextDelayMs(3, 120_000)).toBe(300_000);
    expect(nextDelayMs(4, 120_000)).toBe(600_000);
    expect(nextDelayMs(9, 120_000)).toBe(600_000);
  });

  it('honors a longer Retry-After', () => {
    expect(nextDelayMs(1, 120_000, 900_000)).toBe(900_000);
    expect(nextDelayMs(4, 120_000, 1_000)).toBe(600_000);
  });
});

describe('Scheduler', () => {
  function task(run: () => Promise<Snapshot>, intervalMs = 120_000): ScheduledTask {
    return { id: 'claude', intervalMs: () => intervalMs, run };
  }

  it('runs immediately on start, then every interval', async () => {
    const run = vi.fn(async () => snap('ok'));
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler([task(run)], onSnapshot);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok' }), 120_000);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('backs off after consecutive errors and resets on success', async () => {
    const results = [snap('error'), snap('error'), snap('ok'), snap('ok')];
    const run = vi.fn(async () => results.shift()!);
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler([task(run)], onSnapshot);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.anything(), 60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.anything(), 60_000 + 120_000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ok' }), 180_000 + 120_000);
    scheduler.stop();
  });

  it('turns a thrown error into an error snapshot', async () => {
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler(
      [task(async () => Promise.reject(new Error('boom')))],
      onSnapshot,
    );
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'claude', status: 'error', message: 'boom', limits: [] }),
      60_000,
    );
    scheduler.stop();
  });

  it('refreshNow re-runs only tasks older than the threshold', async () => {
    const run = vi.fn(async () => snap('ok'));
    const scheduler = new Scheduler([task(run)], vi.fn());
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(10_000);
    await scheduler.refreshNow({ olderThanMs: 30_000 });
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(25_000);
    await scheduler.refreshNow({ olderThanMs: 30_000 });
    expect(run).toHaveBeenCalledTimes(2);

    await scheduler.refreshNow();
    expect(run).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('stop cancels timers and ignores in-flight results', async () => {
    let resolve!: (s: Snapshot) => void;
    const onSnapshot = vi.fn();
    const scheduler = new Scheduler([task(() => new Promise((r) => (resolve = r)))], onSnapshot);
    scheduler.start();
    scheduler.stop();
    resolve(snap('ok'));
    await vi.advanceTimersByTimeAsync(1_000_000);
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('setTasks replaces the task list', async () => {
    const first = vi.fn(async () => snap('ok'));
    const second = vi.fn(async () => snap('ok', { providerId: 'codex' }));
    const scheduler = new Scheduler([task(first)], vi.fn());
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.setTasks([{ id: 'codex', intervalMs: () => 30_000, run: second }]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(5); // t=0 (restart) + 4 × 30s
    scheduler.stop();
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/main/scheduler.test.ts`
Expected: FAIL with `Failed to resolve import "./scheduler"`.

- [ ] **Step 7: Implement `scheduler.ts`**

```ts
import type { Snapshot } from '../shared/types';

export const RETRY_STEPS_MS = [60_000, 120_000, 300_000, 600_000] as const;

export function nextDelayMs(consecutiveErrors: number, intervalMs: number, retryAfterMs?: number): number {
  const base =
    consecutiveErrors === 0
      ? intervalMs
      : RETRY_STEPS_MS[Math.min(consecutiveErrors, RETRY_STEPS_MS.length) - 1];
  return Math.max(base, retryAfterMs ?? 0);
}

export interface ScheduledTask {
  id: string;
  intervalMs(): number;
  run(): Promise<Snapshot>;
}

interface TaskState {
  errors: number;
  running: boolean;
  lastRunAt?: number;
  timer?: ReturnType<typeof setTimeout>;
}

export class Scheduler {
  private states = new Map<string, TaskState>();
  /** Bumped by stop(); results from an older generation are dropped. */
  private generation = 0;
  private active = false;

  constructor(
    private tasks: ScheduledTask[],
    private readonly onSnapshot: (snapshot: Snapshot, nextRunAt: number) => void,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    this.active = true;
    for (const task of this.tasks) void this.run(task);
  }

  stop(): void {
    this.active = false;
    this.generation++;
    for (const state of this.states.values()) if (state.timer) clearTimeout(state.timer);
    this.states.clear();
  }

  setTasks(tasks: ScheduledTask[]): void {
    this.stop();
    this.tasks = tasks;
    this.start();
  }

  async refreshNow(options: { olderThanMs?: number } = {}): Promise<void> {
    const now = this.now();
    const due = this.tasks.filter((task) => {
      const lastRunAt = this.states.get(task.id)?.lastRunAt;
      return options.olderThanMs === undefined || lastRunAt === undefined || now - lastRunAt > options.olderThanMs;
    });
    await Promise.all(due.map((task) => this.run(task)));
  }

  private async run(task: ScheduledTask): Promise<void> {
    if (!this.active) return;
    const generation = this.generation;
    const state = this.states.get(task.id) ?? { errors: 0, running: false };
    this.states.set(task.id, state);
    if (state.running) return;
    if (state.timer) clearTimeout(state.timer);
    state.running = true;

    let snapshot: Snapshot;
    try {
      snapshot = await task.run();
    } catch (error) {
      snapshot = {
        providerId: task.id,
        source: null,
        status: 'error',
        dataAsOf: this.now(),
        limits: [],
        message: error instanceof Error ? error.message : String(error),
      };
    }

    if (generation !== this.generation) return;
    state.running = false;
    state.lastRunAt = this.now();
    state.errors = snapshot.status === 'error' ? state.errors + 1 : 0;
    const delay = nextDelayMs(state.errors, task.intervalMs(), snapshot.retryAfterMs);
    state.timer = setTimeout(() => void this.run(task), delay);
    this.onSnapshot(snapshot, state.lastRunAt + delay);
  }
}
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/main/scheduler.test.ts src/main/usage-store.test.ts`
Expected: PASS (all tests).

- [ ] **Step 9: Commit**

```bash
git add src/main/usage-store.ts src/main/scheduler.ts src/main/usage-store.test.ts src/main/scheduler.test.ts
git commit -m "feat: add usage store and polling scheduler with backoff"
```

---
### Task 9: Formatting helpers and island view model

**Files:**
- Create: `src/shared/format.ts`
- Create: `src/shared/view-model.ts`
- Test: `src/shared/format.test.ts`, `src/shared/view-model.test.ts`

**Interfaces:**
- Consumes: `Limit`, `Snapshot`, `Source`, `ProviderStatus` (Task 2); `MINUTE`, `HOUR`, `DAY` (Task 1). Its input shape matches `StoreEntry` from Task 8, but it's declared structurally so the shared code never imports main code.
- Produces:
  ```ts
  function formatReset(resetsAt: number | null, now: number, timeZone?: string): string;
  function formatDuration(ms: number): string;     // "<1 min" | "5 min" | "3 hr" | "1 day" | "4 days"
  function formatPercent(percent: number): string; // "73%"
  type Level = 'normal' | 'warn' | 'critical';
  interface LimitView extends Limit { level: Level }
  interface ProviderView {
    id: string; name: string; shortName: string; plan?: string; source: Source | null;
    status: ProviderStatus; message?: string; dataAsOf: number | null; fromLogs: boolean;
    retryAt?: number; limits: LimitView[]; maxPercent: number | null; level: Level;
  }
  interface IslandView { providers: ProviderView[]; generatedAt: number }
  function levelFor(percent: number | null, warnPercent: number, criticalPercent: number): Level;
  interface ProviderViewInput {
    id: string; name: string; shortName: string; fromLogs: boolean; staleAfterMs: number;
    entry?: { latest: Snapshot; lastGood?: Snapshot; nextRunAt?: number };
    now: number; warnPercent: number; criticalPercent: number;
  }
  function buildProviderView(input: ProviderViewInput): ProviderView;
  ```

- [ ] **Step 1: Write the failing format tests**

`src/shared/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatDuration, formatPercent, formatReset } from './format';

const now = Date.UTC(2026, 8, 15, 17, 0); // Tue 15 Sep 2026, 17:00 UTC

describe('formatReset', () => {
  it('uses relative text under 24 hours', () => {
    expect(formatReset(now + 2 * 3_600_000 + 8 * 60_000, now)).toBe('Resets in 2 hr 8 min');
    expect(formatReset(now + 3 * 3_600_000, now)).toBe('Resets in 3 hr');
    expect(formatReset(now + 45 * 60_000, now)).toBe('Resets in 45 min');
    expect(formatReset(now + 20_000, now)).toBe('Resets in 1 min');
  });

  it('uses weekday and time at 24 hours or more', () => {
    expect(formatReset(Date.UTC(2026, 8, 21, 13, 0), now, 'UTC')).toBe('Resets Mon 1:00 PM');
  });

  it('says the window reset once the time has passed', () => {
    expect(formatReset(now - 1, now)).toBe('Reset since last seen');
  });

  it('returns an empty string without a reset time', () => {
    expect(formatReset(null, now)).toBe('');
  });
});

describe('formatDuration', () => {
  it.each([
    [10_000, '<1 min'],
    [5 * 60_000, '5 min'],
    [3 * 3_600_000 + 59 * 60_000, '3 hr'],
    [26 * 3_600_000, '1 day'],
    [4 * 86_400_000, '4 days'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(72.6)).toBe('73%');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/shared/format.test.ts`
Expected: FAIL with `Failed to resolve import "./format"`.

- [ ] **Step 3: Implement `format.ts`**

```ts
import { DAY, HOUR, MINUTE } from './time';

export function formatReset(resetsAt: number | null, now: number, timeZone?: string): string {
  if (resetsAt === null) return '';
  const remaining = resetsAt - now;
  if (remaining <= 0) return 'Reset since last seen';
  if (remaining < DAY) {
    const totalMinutes = Math.ceil(remaining / MINUTE);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `Resets in ${minutes} min`;
    return minutes === 0 ? `Resets in ${hours} hr` : `Resets in ${hours} hr ${minutes} min`;
  }
  const text = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone })
    .format(new Date(resetsAt))
    .replace(/ /g, ' ') // ICU puts a narrow no-break space before AM/PM
    .replace(',', '');
  return `Resets ${text}`;
}

export function formatDuration(ms: number): string {
  if (ms < MINUTE) return '<1 min';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} hr`;
  const days = Math.floor(ms / DAY);
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/shared/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing view-model tests**

`src/shared/view-model.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Snapshot } from './types';
import { buildProviderView, levelFor, type ProviderViewInput } from './view-model';

const now = Date.UTC(2026, 8, 15, 17, 0);
const source = { kind: 'wsl' as const, label: 'WSL · Ubuntu', home: '/home/me' };

const okSnapshot = (dataAsOf: number, fiveHour = 73): Snapshot => ({
  providerId: 'claude',
  source,
  plan: 'Max (5x)',
  status: 'ok',
  dataAsOf,
  limits: [
    { id: 'five_hour', label: '5-hour limit', usedPercent: fiveHour, resetsAt: now + 3_600_000 },
    { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: now + 5 * 86_400_000 },
  ],
});

const input = (entry: ProviderViewInput['entry'], extra: Partial<ProviderViewInput> = {}): ProviderViewInput => ({
  id: 'claude',
  name: 'Claude',
  shortName: 'Claude',
  fromLogs: false,
  staleAfterMs: 600_000,
  entry,
  now,
  warnPercent: 80,
  criticalPercent: 95,
  ...extra,
});

describe('levelFor', () => {
  it('maps percentages to levels', () => {
    expect(levelFor(null, 80, 95)).toBe('normal');
    expect(levelFor(79.9, 80, 95)).toBe('normal');
    expect(levelFor(80, 80, 95)).toBe('warn');
    expect(levelFor(95, 80, 95)).toBe('critical');
  });
});

describe('buildProviderView', () => {
  it('shows fresh ok data with levels and the highest percent', () => {
    const view = buildProviderView(input({ latest: okSnapshot(now - 60_000, 86) }));
    expect(view).toMatchObject({ status: 'ok', plan: 'Max (5x)', source, maxPercent: 86, level: 'warn', dataAsOf: now - 60_000 });
    expect(view.limits.map((l) => l.level)).toEqual(['warn', 'normal']);
  });

  it('marks ok data as stale once it is older than staleAfterMs', () => {
    expect(buildProviderView(input({ latest: okSnapshot(now - 601_000) })).status).toBe('stale');
  });

  it('keeps last-good limits when the latest fetch failed, with retry time', () => {
    const failed: Snapshot = { providerId: 'claude', source, status: 'error', dataAsOf: now, limits: [], message: "Couldn't reach Anthropic" };
    const view = buildProviderView(input({ latest: failed, lastGood: okSnapshot(now - 120_000), nextRunAt: now + 120_000 }));
    expect(view).toMatchObject({ status: 'error', message: "Couldn't reach Anthropic", retryAt: now + 120_000, maxPercent: 73, plan: 'Max (5x)' });
    expect(view.limits).toHaveLength(2);
  });

  it('shows no limits when the provider is not found', () => {
    const missing: Snapshot = { providerId: 'claude', source: null, status: 'not-found', dataAsOf: now, limits: [], message: 'No login' };
    const view = buildProviderView(input({ latest: missing, lastGood: okSnapshot(now - 1) }));
    expect(view).toMatchObject({ status: 'not-found', limits: [], maxPercent: null, message: 'No login' });
  });

  it('hides the percent of a window whose reset has passed', () => {
    const snapshot = okSnapshot(now - 60_000);
    snapshot.limits[0] = { ...snapshot.limits[0], usedPercent: 97, resetsAt: now - 1 };
    const view = buildProviderView(input({ latest: snapshot }));
    expect(view.limits[0].usedPercent).toBeNull();
    expect(view.maxPercent).toBe(29);
  });

  it('reports a checking state before the first fetch', () => {
    expect(buildProviderView(input(undefined))).toMatchObject({ status: 'stale', message: 'Checking…', limits: [], maxPercent: null, dataAsOf: null });
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/shared/view-model.test.ts`
Expected: FAIL with `Failed to resolve import "./view-model"`.

- [ ] **Step 7: Implement `view-model.ts`**

```ts
import type { Limit, ProviderStatus, Snapshot, Source } from './types';

export type Level = 'normal' | 'warn' | 'critical';

export interface LimitView extends Limit {
  level: Level;
}

export interface ProviderView {
  id: string;
  name: string;
  shortName: string;
  plan?: string;
  source: Source | null;
  status: ProviderStatus;
  message?: string;
  dataAsOf: number | null;
  fromLogs: boolean;
  retryAt?: number;
  limits: LimitView[];
  maxPercent: number | null;
  level: Level;
}

export interface IslandView {
  providers: ProviderView[];
  generatedAt: number;
}

export function levelFor(percent: number | null, warnPercent: number, criticalPercent: number): Level {
  if (percent === null) return 'normal';
  if (percent >= criticalPercent) return 'critical';
  if (percent >= warnPercent) return 'warn';
  return 'normal';
}

export interface ProviderViewInput {
  id: string;
  name: string;
  shortName: string;
  fromLogs: boolean;
  staleAfterMs: number;
  entry?: { latest: Snapshot; lastGood?: Snapshot; nextRunAt?: number };
  now: number;
  warnPercent: number;
  criticalPercent: number;
}

export function buildProviderView(input: ProviderViewInput): ProviderView {
  const { entry, now, warnPercent, criticalPercent } = input;
  const base = { id: input.id, name: input.name, shortName: input.shortName, fromLogs: input.fromLogs };

  if (!entry) {
    return { ...base, source: null, status: 'stale', message: 'Checking…', dataAsOf: null, limits: [], maxPercent: null, level: 'normal' };
  }

  const { latest, lastGood } = entry;
  const shown = latest.status === 'ok' ? latest : lastGood;
  const status: ProviderStatus =
    latest.status === 'ok' && now - latest.dataAsOf > input.staleAfterMs ? 'stale' : latest.status;

  const limits: LimitView[] =
    latest.status === 'not-found'
      ? []
      : (shown?.limits ?? []).map((limit) => {
          const usedPercent = limit.resetsAt !== null && limit.resetsAt <= now ? null : limit.usedPercent;
          return { ...limit, usedPercent, level: levelFor(usedPercent, warnPercent, criticalPercent) };
        });

  const percents = limits.map((l) => l.usedPercent).filter((p): p is number => p !== null);
  const maxPercent = percents.length > 0 ? Math.max(...percents) : null;

  return {
    ...base,
    plan: latest.plan ?? shown?.plan,
    source: latest.source ?? shown?.source ?? null,
    status,
    message: latest.message,
    dataAsOf: latest.status === 'not-found' ? null : (shown?.dataAsOf ?? null),
    retryAt: latest.status === 'error' ? entry.nextRunAt : undefined,
    limits,
    maxPercent,
    level: levelFor(maxPercent, warnPercent, criticalPercent),
  };
}
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/shared`
Expected: PASS (all shared tests).

- [ ] **Step 9: Commit**

```bash
git add src/shared/format.ts src/shared/format.test.ts src/shared/view-model.ts src/shared/view-model.test.ts
git commit -m "feat: add reset/duration formatting and island view model"
```

---

### Task 10: Alert engine and alert text

**Files:**
- Create: `src/main/alert-engine.ts`
- Create: `src/main/alert-text.ts`
- Test: `src/main/alert-engine.test.ts`, `src/main/alert-text.test.ts`

**Interfaces:**
- Consumes: `Snapshot` (Task 2); `DAY` (Task 1); `formatReset` (Task 9).
- Produces:
  ```ts
  type AlertEvent =
    | { kind: 'threshold'; providerId: string; limitId: string; limitLabel: string; percent: number; threshold: number; resetsAt: number | null }
    | { kind: 'reset'; providerId: string; limitId: string; limitLabel: string };
  interface EvaluateArgs { previous?: Snapshot; next: Snapshot; warnPercent: number; criticalPercent: number; now: number }
  class AlertEngine {
    constructor(fired?: Iterable<string>);
    evaluate(args: EvaluateArgs): AlertEvent[];
    prune(now: number): void;
    firedKeys(): string[];
  }
  function alertText(event: AlertEvent, providerName: string, now: number): { title: string; body: string };
  ```

- [ ] **Step 1: Write the failing tests**

`src/main/alert-engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../shared/types';
import { AlertEngine } from './alert-engine';

const now = Date.UTC(2026, 8, 15, 17, 0);
const periodEnd = now + 3_600_000;

const snapshot = (usedPercent: number | null, resetsAt: number | null = periodEnd, status: Snapshot['status'] = 'ok'): Snapshot => ({
  providerId: 'claude',
  source: null,
  status,
  dataAsOf: now,
  limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent, resetsAt }],
});

const args = { warnPercent: 80, criticalPercent: 95, now };

describe('AlertEngine thresholds', () => {
  it('fires once when a limit crosses the warning threshold', () => {
    const engine = new AlertEngine();
    expect(engine.evaluate({ ...args, previous: snapshot(70), next: snapshot(82) })).toEqual([
      { kind: 'threshold', providerId: 'claude', limitId: 'five_hour', limitLabel: '5-hour limit', percent: 82, threshold: 80, resetsAt: periodEnd },
    ]);
    expect(engine.evaluate({ ...args, previous: snapshot(82), next: snapshot(85) })).toEqual([]);
  });

  it('reports only the critical threshold when both are crossed at once', () => {
    const events = new AlertEngine().evaluate({ ...args, previous: snapshot(10), next: snapshot(97) });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ threshold: 95 });
  });

  it('fires again in the next period', () => {
    const engine = new AlertEngine();
    engine.evaluate({ ...args, next: snapshot(90) });
    const nextPeriod = periodEnd + 5 * 3_600_000;
    expect(engine.evaluate({ ...args, next: snapshot(90, nextPeriod) })).toHaveLength(1);
  });

  it('does not repeat after a restart with persisted keys', () => {
    const first = new AlertEngine();
    first.evaluate({ ...args, next: snapshot(90) });
    const restarted = new AlertEngine(first.firedKeys());
    expect(restarted.evaluate({ ...args, next: snapshot(91) })).toEqual([]);
  });

  it('ignores non-ok snapshots and cleared percentages', () => {
    const engine = new AlertEngine();
    expect(engine.evaluate({ ...args, next: snapshot(99, periodEnd, 'error') })).toEqual([]);
    expect(engine.evaluate({ ...args, next: snapshot(null) })).toEqual([]);
  });
});

describe('AlertEngine resets', () => {
  it('fires when a busy window resets into a new period', () => {
    const engine = new AlertEngine();
    const previous = snapshot(88, now - 60_000);
    const events = engine.evaluate({ ...args, previous, next: snapshot(3, now + 5 * 3_600_000) });
    expect(events).toEqual([{ kind: 'reset', providerId: 'claude', limitId: 'five_hour', limitLabel: '5-hour limit' }]);
    expect(engine.evaluate({ ...args, previous, next: snapshot(4, now + 5 * 3_600_000) })).toEqual([]);
  });

  it('fires for log data whose window passed (percent cleared)', () => {
    const events = new AlertEngine().evaluate({ ...args, previous: snapshot(90, now - 60_000), next: snapshot(null, now - 60_000) });
    expect(events.map((e) => e.kind)).toEqual(['reset']);
  });

  it('stays quiet when a lightly used window resets', () => {
    const events = new AlertEngine().evaluate({ ...args, previous: snapshot(20, now - 60_000), next: snapshot(0, now + 3_600_000) });
    expect(events).toEqual([]);
  });
});

describe('AlertEngine.prune', () => {
  it('drops keys for periods that ended more than a day ago', () => {
    const engine = new AlertEngine([
      `threshold|claude|five_hour|${now - 2 * 86_400_000}|80`,
      `threshold|claude|five_hour|${now + 1}|80`,
      'threshold|claude|five_hour|null|80',
    ]);
    engine.prune(now);
    expect(engine.firedKeys()).toEqual([`threshold|claude|five_hour|${now + 1}|80`, 'threshold|claude|five_hour|null|80']);
  });
});
```

`src/main/alert-text.test.ts`:
```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/alert-engine.test.ts src/main/alert-text.test.ts`
Expected: FAIL with `Failed to resolve import`.

- [ ] **Step 3: Implement `alert-engine.ts` and `alert-text.ts`**

`src/main/alert-engine.ts`:
```ts
import { DAY } from '../shared/time';
import type { Limit, Snapshot } from '../shared/types';

export type AlertEvent =
  | { kind: 'threshold'; providerId: string; limitId: string; limitLabel: string; percent: number; threshold: number; resetsAt: number | null }
  | { kind: 'reset'; providerId: string; limitId: string; limitLabel: string };

export interface EvaluateArgs {
  previous?: Snapshot;
  next: Snapshot;
  warnPercent: number;
  criticalPercent: number;
  now: number;
}

// Keys: threshold|<provider>|<limit>|<resetsAt>|<threshold>  and  reset|<provider>|<limit>|<previous resetsAt>
const thresholdKey = (providerId: string, limit: Limit, threshold: number) =>
  `threshold|${providerId}|${limit.id}|${limit.resetsAt}|${threshold}`;
const resetKey = (providerId: string, limitId: string, resetsAt: number) => `reset|${providerId}|${limitId}|${resetsAt}`;

export class AlertEngine {
  private readonly fired: Set<string>;

  constructor(fired: Iterable<string> = []) {
    this.fired = new Set(fired);
  }

  evaluate({ previous, next, warnPercent, criticalPercent, now }: EvaluateArgs): AlertEvent[] {
    if (next.status !== 'ok') return [];
    const events: AlertEvent[] = [];
    const previousById = new Map((previous?.limits ?? []).map((limit) => [limit.id, limit]));

    for (const limit of next.limits) {
      const before = previousById.get(limit.id);
      const periodEnded =
        before !== undefined &&
        before.usedPercent !== null &&
        before.usedPercent >= warnPercent &&
        before.resetsAt !== null &&
        before.resetsAt <= now &&
        (limit.usedPercent === null || limit.resetsAt === null || limit.resetsAt > before.resetsAt);
      if (periodEnded) {
        const key = resetKey(next.providerId, limit.id, before.resetsAt!);
        if (!this.fired.has(key)) {
          this.fired.add(key);
          events.push({ kind: 'reset', providerId: next.providerId, limitId: limit.id, limitLabel: limit.label });
        }
      }

      const percent = limit.usedPercent;
      if (percent === null) continue;
      const crossed = [criticalPercent, warnPercent].filter((threshold) => percent >= threshold);
      if (crossed.length === 0) continue;
      const highestIsNew = !this.fired.has(thresholdKey(next.providerId, limit, crossed[0]));
      for (const threshold of crossed) this.fired.add(thresholdKey(next.providerId, limit, threshold));
      if (highestIsNew) {
        events.push({
          kind: 'threshold',
          providerId: next.providerId,
          limitId: limit.id,
          limitLabel: limit.label,
          percent,
          threshold: crossed[0],
          resetsAt: limit.resetsAt,
        });
      }
    }
    return events;
  }

  prune(now: number): void {
    for (const key of this.fired) {
      const resetsAt = Number(key.split('|')[3]);
      if (Number.isFinite(resetsAt) && resetsAt < now - DAY) this.fired.delete(key);
    }
  }

  firedKeys(): string[] {
    return [...this.fired];
  }
}
```

`src/main/alert-text.ts`:
```ts
import { formatPercent, formatReset } from '../shared/format';
import type { AlertEvent } from './alert-engine';

export function alertText(event: AlertEvent, providerName: string, now: number): { title: string; body: string } {
  if (event.kind === 'reset') {
    return { title: `${providerName} · ${event.limitLabel} has reset`, body: 'A new usage window has started' };
  }
  const passed = `Passed ${event.threshold}%`;
  return {
    title: `${providerName} · ${event.limitLabel} at ${formatPercent(event.percent)}`,
    body: event.resetsAt === null ? passed : `${passed} · ${formatReset(event.resetsAt, now)}`,
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/alert-engine.test.ts src/main/alert-text.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/alert-engine.ts src/main/alert-text.ts src/main/alert-engine.test.ts src/main/alert-text.test.ts
git commit -m "feat: add threshold and reset alert engine"
```

---
### Task 11: Log redaction, island geometry and fullscreen detection (pure parts)

**Files:**
- Create: `src/main/redact.ts`
- Create: `src/main/island-geometry.ts`
- Create: `src/main/fullscreen.ts`
- Test: `src/main/redact.test.ts`, `src/main/island-geometry.test.ts`, `src/main/fullscreen.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  function redact(text: string): string;
  function redactValue(value: unknown): unknown;
  interface Rect { x: number; y: number; width: number; height: number }
  interface DisplayInfo { id: number; label: string; primary: boolean; bounds: Rect; workArea: Rect }
  function pickDisplay(displays: DisplayInfo[], preferredId: number | null): DisplayInfo;
  function islandBounds(workArea: Rect, size: { width: number; height: number }): Rect;
  interface ForegroundWindow { rect: { left: number; top: number; right: number; bottom: number }; className: string }
  function coversDisplay(window: ForegroundWindow, displayBoundsPx: Rect): boolean;
  class FullscreenWatch {
    constructor(read: () => ForegroundWindow | null, displayBoundsPx: () => Rect, onChange: (fullscreen: boolean) => void, intervalMs?: number);
    start(): void; stop(): void; tick(): void;
  }
  ```

- [ ] **Step 1: Write the failing tests**

`src/main/redact.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { redact, redactValue } from './redact';

describe('redact', () => {
  it.each([
    ['Authorization: Bearer sk-ant-oat01-abcdefghijklmnop', 'Authorization: [redacted]'],
    ['key sk-ant-oat01-abcdefghijklmnop end', 'key [redacted] end'],
    ['jwt eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl here', 'jwt [redacted] here'],
    ['{"accessToken":"abc123","x":1}', '{"accessToken":"[redacted]","x":1}'],
    ['refresh_token=xyz789&a=b', 'refresh_token=[redacted]&a=b'],
  ])('%s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it('leaves ordinary text alone', () => {
    expect(redact('Claude 5-hour limit at 82%')).toBe('Claude 5-hour limit at 82%');
  });
});

describe('redactValue', () => {
  it('redacts strings, errors and nested objects', () => {
    expect(redactValue('Bearer abc.def')).toBe('[redacted]');
    expect((redactValue(new Error('failed with Bearer abc')) as Error).message).toBe('failed with [redacted]');
    expect(redactValue({ headers: { Authorization: 'Bearer abc' }, accessToken: 'zzz' })).toEqual({
      headers: { Authorization: '[redacted]' },
      accessToken: '[redacted]',
    });
    expect(redactValue(42)).toBe(42);
  });
});
```

`src/main/island-geometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { islandBounds, pickDisplay, type DisplayInfo } from './island-geometry';

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const primary: DisplayInfo = { id: 1, label: 'Display 1', primary: true, bounds: rect(0, 0, 1920, 1080), workArea: rect(0, 0, 1920, 1040) };
const side: DisplayInfo = { id: 2, label: 'Display 2', primary: false, bounds: rect(1920, 0, 2560, 1440), workArea: rect(1920, 0, 2560, 1400) };

describe('pickDisplay', () => {
  it('uses the preferred display when connected', () => {
    expect(pickDisplay([primary, side], 2)).toBe(side);
  });

  it('falls back to the primary display', () => {
    expect(pickDisplay([side, primary], 99)).toBe(primary);
    expect(pickDisplay([side, primary], null)).toBe(primary);
  });

  it('falls back to the first display when none is primary', () => {
    expect(pickDisplay([{ ...side, primary: false }], null).id).toBe(2);
  });
});

describe('islandBounds', () => {
  it('centers the island at the top of the work area', () => {
    expect(islandBounds(side.workArea, { width: 260.4, height: 33.2 })).toEqual({ x: 1920 + 1150, y: 0, width: 261, height: 34 });
  });

  it('respects a taskbar docked at the top', () => {
    expect(islandBounds(rect(0, 48, 1920, 1032), { width: 300, height: 40 })).toEqual({ x: 810, y: 48, width: 300, height: 40 });
  });

  it('never exceeds the work area width', () => {
    expect(islandBounds(rect(0, 0, 200, 1000), { width: 360, height: 300 }).width).toBe(200);
  });
});
```

`src/main/fullscreen.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenWatch, coversDisplay, type ForegroundWindow } from './fullscreen';

const display = { x: 0, y: 0, width: 1920, height: 1080 };
const win = (left: number, top: number, right: number, bottom: number, className = 'Chrome_WidgetWin_1'): ForegroundWindow => ({
  rect: { left, top, right, bottom },
  className,
});

describe('coversDisplay', () => {
  it('is true for a window covering the whole display', () => {
    expect(coversDisplay(win(0, 0, 1920, 1080), display)).toBe(true);
  });

  it('is false for a maximized window that leaves the taskbar visible', () => {
    expect(coversDisplay(win(-8, -8, 1928, 1048), display)).toBe(false);
  });

  it('is false for the desktop and shell windows', () => {
    expect(coversDisplay(win(0, 0, 1920, 1080, 'Progman'), display)).toBe(false);
    expect(coversDisplay(win(0, 0, 1920, 1080, 'WorkerW'), display)).toBe(false);
  });
});

describe('FullscreenWatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports changes only when the fullscreen state flips', () => {
    let current: ForegroundWindow | null = win(0, 0, 800, 600);
    const onChange = vi.fn();
    const watch = new FullscreenWatch(() => current, () => display, onChange, 1500);

    watch.start();
    vi.advanceTimersByTime(1500);
    expect(onChange).not.toHaveBeenCalled();

    current = win(0, 0, 1920, 1080);
    vi.advanceTimersByTime(1500);
    vi.advanceTimersByTime(1500);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    watch.stop();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('treats reader errors as not fullscreen', () => {
    const onChange = vi.fn();
    const watch = new FullscreenWatch(() => {
      throw new Error('user32 failed');
    }, () => display, onChange);
    watch.tick();
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/main/redact.test.ts src/main/island-geometry.test.ts src/main/fullscreen.test.ts`
Expected: FAIL with `Failed to resolve import`.

- [ ] **Step 3: Implement the three modules**

`src/main/redact.ts`:
```ts
const SECRET_FIELD = /("?(?:access_?token|refresh_?token|id_?token|api_?key|authorization)"?\s*[:=]\s*"?)[^"&,\s}]+/gi;
const PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g,
  /\bsk-[A-Za-z0-9_-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
];
const SECRET_KEYS = /^(access_?token|refresh_?token|id_?token|api_?key|authorization)$/i;

export function redact(text: string): string {
  let out = text;
  for (const pattern of PATTERNS) out = out.replace(pattern, '[redacted]');
  return out.replace(SECRET_FIELD, (match, prefix: string) => (match.endsWith('[redacted]') ? match : `${prefix}[redacted]`));
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redact(value);
  if (value instanceof Error) {
    const copy = new Error(redact(value.message));
    copy.stack = value.stack ? redact(value.stack) : undefined;
    return copy;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_KEYS.test(key) ? '[redacted]' : redactValue(inner)]),
    );
  }
  return value;
}
```

`src/main/island-geometry.ts`:
```ts
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  bounds: Rect;
  workArea: Rect;
}

export function pickDisplay(displays: DisplayInfo[], preferredId: number | null): DisplayInfo {
  return (
    displays.find((d) => d.id === preferredId) ??
    displays.find((d) => d.primary) ??
    displays[0]
  );
}

export function islandBounds(workArea: Rect, size: { width: number; height: number }): Rect {
  const width = Math.min(Math.ceil(size.width), workArea.width);
  const height = Math.ceil(size.height);
  return { x: workArea.x + Math.round((workArea.width - width) / 2), y: workArea.y, width, height };
}
```

`src/main/fullscreen.ts`:
```ts
import type { Rect } from './island-geometry';

export interface ForegroundWindow {
  /** Physical pixels, as returned by GetWindowRect */
  rect: { left: number; top: number; right: number; bottom: number };
  className: string;
}

const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);

export function coversDisplay(window: ForegroundWindow, displayBoundsPx: Rect): boolean {
  if (SHELL_CLASSES.has(window.className)) return false;
  const { left, top, right, bottom } = window.rect;
  return (
    left <= displayBoundsPx.x &&
    top <= displayBoundsPx.y &&
    right >= displayBoundsPx.x + displayBoundsPx.width &&
    bottom >= displayBoundsPx.y + displayBoundsPx.height
  );
}

export class FullscreenWatch {
  private timer?: ReturnType<typeof setInterval>;
  private fullscreen = false;

  constructor(
    private readonly read: () => ForegroundWindow | null,
    private readonly displayBoundsPx: () => Rect,
    private readonly onChange: (fullscreen: boolean) => void,
    private readonly intervalMs = 1500,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.fullscreen) {
      this.fullscreen = false;
      this.onChange(false);
    }
  }

  tick(): void {
    let next = false;
    try {
      const window = this.read();
      next = window !== null && coversDisplay(window, this.displayBoundsPx());
    } catch {
      next = false;
    }
    if (next !== this.fullscreen) {
      this.fullscreen = next;
      this.onChange(next);
    }
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/main/redact.test.ts src/main/island-geometry.test.ts src/main/fullscreen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/redact.ts src/main/island-geometry.ts src/main/fullscreen.ts src/main/redact.test.ts src/main/island-geometry.test.ts src/main/fullscreen.test.ts
git commit -m "feat: add log redaction, island placement and fullscreen detection logic"
```

---
### Task 12: IPC contract, preload and the Electron main shell

This task wires the tested modules into a running app: island window, scheduler, store and IPC. The island temporarily renders the raw view as text; Task 13 replaces that with the real UI. `app.ts` contains marker comments (`// [task-14] …`) that later tasks replace.

**Files:**
- Create: `src/shared/ipc.ts`
- Create: `src/preload/index.ts` (replaces the Task 1 placeholder)
- Create: `src/renderer/env.d.ts`
- Create: `src/main/log.ts`, `src/main/renderer-url.ts`, `src/main/displays.ts`, `src/main/island-window.ts`
- Create: `src/main/providers/index.ts`
- Create: `src/main/app.ts`
- Modify: `src/main/index.ts` (replace the Task 1 hello window)
- Modify: `src/renderer/island/main.tsx` (temporary text view)

**Interfaces:**
- Consumes:
  - `IslandView`, `buildProviderView` (Task 9)
  - `Settings`, `SettingsPatch`, `mergeSettings`, `providerSettings` (Task 2)
  - `loadSettings`, `saveSettings` (Task 7); `loadState`, `saveState` (Task 7)
  - `UsageStore` (Task 8); `Scheduler`, `ScheduledTask` (Task 8)
  - `listCandidateHomes`, `defaultDetectDeps`, `pickSource` (Task 6)
  - `createClaudePlugin` (Task 5); `createCodexPlugin` (Task 4); `ProviderPlugin` (Task 4)
  - `pickDisplay`, `islandBounds`, `DisplayInfo` (Task 11); `redactValue` (Task 11)
  - `APP_ID` (Task 1); `MINUTE` (Task 1)
- Produces:
  ```ts
  const IPC: { viewGet: 'usage:get'; viewUpdate: 'usage:update'; refresh: 'usage:refresh';
               islandResize: 'island:resize'; islandSetExpanded: 'island:setExpanded';
               islandCollapse: 'island:collapse'; islandExpand: 'island:expand';
               openUsagePage: 'app:openUsagePage'; openSettings: 'app:openSettings';
               settingsGet: 'settings:get'; settingsSet: 'settings:set';
               providersGet: 'providers:get'; displaysGet: 'displays:get' };
  interface SourceOption { kind: SourceKind; label: string; home: string; lastModifiedMs: number }
  interface DisplayOption { id: number; label: string; primary: boolean }
  interface ProviderOption { id: string; name: string; sources: SourceOption[] }
  interface Api {
    getView(): Promise<IslandView>; onView(listener: (view: IslandView) => void): () => void;
    refresh(olderThanMs?: number): Promise<void>;
    resizeIsland(width: number, height: number): void; setExpanded(expanded: boolean): void;
    onCollapse(listener: () => void): () => void; onExpand(listener: () => void): () => void;
    openUsagePage(providerId: string): void; openSettings(): void;
    getSettings(): Promise<Settings>; setSettings(patch: SettingsPatch): Promise<Settings>;
    getProviders(): Promise<ProviderOption[]>; getDisplays(): Promise<DisplayOption[]>;
  }
  // window.api: Api (renderer global)
  function initLog(): typeof import('electron-log/main').default;
  function loadRenderer(win: BrowserWindow, page: 'island' | 'settings'): void;
  function listDisplays(): DisplayInfo[];
  class IslandWindow { constructor(getDisplay: () => DisplayInfo); win: BrowserWindow;
    resize(width: number, height: number): void; setExpanded(expanded: boolean): void; expand(): void;
    reposition(): void; setFullscreenHidden(hidden: boolean): void; toggleUserHidden(): void;
    isUserVisible(): boolean; show(): void }
  function createProviders(): ProviderPlugin[];
  function startApp(log: ReturnType<typeof initLog>): Promise<RunningApp>;
  interface RunningApp { island: IslandWindow; scheduler: Scheduler }
  ```

- [ ] **Step 1: Create the IPC contract `src/shared/ipc.ts`**

```ts
import type { Settings, SettingsPatch } from './settings-schema';
import type { SourceKind } from './types';
import type { IslandView } from './view-model';

export const IPC = {
  viewGet: 'usage:get',
  viewUpdate: 'usage:update',
  refresh: 'usage:refresh',
  islandResize: 'island:resize',
  islandSetExpanded: 'island:setExpanded',
  islandCollapse: 'island:collapse',
  islandExpand: 'island:expand',
  openUsagePage: 'app:openUsagePage',
  openSettings: 'app:openSettings',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  providersGet: 'providers:get',
  displaysGet: 'displays:get',
} as const;

export interface SourceOption {
  kind: SourceKind;
  label: string;
  home: string;
  lastModifiedMs: number;
}

export interface DisplayOption {
  id: number;
  label: string;
  primary: boolean;
}

export interface ProviderOption {
  id: string;
  name: string;
  sources: SourceOption[];
}

export interface Api {
  getView(): Promise<IslandView>;
  onView(listener: (view: IslandView) => void): () => void;
  refresh(olderThanMs?: number): Promise<void>;
  resizeIsland(width: number, height: number): void;
  setExpanded(expanded: boolean): void;
  onCollapse(listener: () => void): () => void;
  onExpand(listener: () => void): () => void;
  openUsagePage(providerId: string): void;
  openSettings(): void;
  getSettings(): Promise<Settings>;
  setSettings(patch: SettingsPatch): Promise<Settings>;
  getProviders(): Promise<ProviderOption[]>;
  getDisplays(): Promise<DisplayOption[]>;
}
```

- [ ] **Step 2: Create the preload and renderer global type**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type Api } from '../shared/ipc';
import type { IslandView } from '../shared/view-model';

function subscribe<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...(args as T));
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: Api = {
  getView: () => ipcRenderer.invoke(IPC.viewGet),
  onView: (listener) => subscribe<[IslandView]>(IPC.viewUpdate, listener),
  refresh: (olderThanMs) => ipcRenderer.invoke(IPC.refresh, olderThanMs),
  resizeIsland: (width, height) => ipcRenderer.send(IPC.islandResize, width, height),
  setExpanded: (expanded) => ipcRenderer.send(IPC.islandSetExpanded, expanded),
  onCollapse: (listener) => subscribe(IPC.islandCollapse, listener),
  onExpand: (listener) => subscribe(IPC.islandExpand, listener),
  openUsagePage: (providerId) => ipcRenderer.send(IPC.openUsagePage, providerId),
  openSettings: () => ipcRenderer.send(IPC.openSettings),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  getProviders: () => ipcRenderer.invoke(IPC.providersGet),
  getDisplays: () => ipcRenderer.invoke(IPC.displaysGet),
};

contextBridge.exposeInMainWorld('api', api);
```

`src/renderer/env.d.ts`:
```ts
import type { Api } from '../shared/ipc';

declare global {
  interface Window {
    api: Api;
  }
}

export {};
```

- [ ] **Step 3: Create the small Electron helpers**

`src/main/log.ts`:
```ts
import log from 'electron-log/main';
import { redactValue } from './redact';

export function initLog() {
  log.initialize();
  log.transports.file.level = 'info';
  // Every log line passes through redaction before reaching console or file.
  log.hooks.push((message) => ({ ...message, data: message.data.map(redactValue) }));
  return log;
}
```

`src/main/renderer-url.ts`:
```ts
import { app, type BrowserWindow } from 'electron';
import { join } from 'node:path';

export function loadRenderer(win: BrowserWindow, page: 'island' | 'settings'): void {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}.html`);
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`));
  }
}
```

`src/main/displays.ts`:
```ts
import { screen } from 'electron';
import type { DisplayInfo } from './island-geometry';

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    label: display.label || `Display ${index + 1} (${display.size.width}×${display.size.height})`,
    primary: display.id === primaryId,
    bounds: display.bounds,
    workArea: display.workArea,
  }));
}
```

- [ ] **Step 4: Create `src/main/island-window.ts`**

```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { islandBounds, type DisplayInfo } from './island-geometry';
import { loadRenderer } from './renderer-url';

export class IslandWindow {
  readonly win: BrowserWindow;
  private size = { width: 260, height: 34 };
  private expanded = false;
  private userHidden = false;
  private fullscreenHidden = false;

  constructor(private readonly getDisplay: () => DisplayInfo) {
    this.win = new BrowserWindow({
      ...this.size,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    this.win.setAlwaysOnTop(true, 'screen-saver');
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.win.webContents.on('will-navigate', (event) => event.preventDefault());
    this.win.on('blur', () => {
      if (this.expanded) this.win.webContents.send(IPC.islandCollapse);
    });
    this.win.once('ready-to-show', () => {
      this.reposition();
      this.applyVisibility();
    });
    loadRenderer(this.win, 'island');
  }

  resize(width: number, height: number): void {
    this.size = { width, height };
    this.reposition();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    // Focus is needed so clicking elsewhere blurs the window and collapses it.
    if (expanded) this.win.focus();
  }

  /** Expand from outside the renderer, e.g. a notification click. */
  expand(): void {
    this.show();
    this.win.webContents.send(IPC.islandExpand);
  }

  reposition(): void {
    if (this.win.isDestroyed()) return;
    this.win.setBounds(islandBounds(this.getDisplay().workArea, this.size));
  }

  setFullscreenHidden(hidden: boolean): void {
    this.fullscreenHidden = hidden;
    this.applyVisibility();
  }

  toggleUserHidden(): void {
    this.userHidden = !this.userHidden;
    this.applyVisibility();
  }

  isUserVisible(): boolean {
    return !this.userHidden;
  }

  show(): void {
    this.userHidden = false;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    if (this.win.isDestroyed()) return;
    if (this.userHidden || this.fullscreenHidden) {
      this.win.hide();
    } else {
      this.win.showInactive();
      this.win.setAlwaysOnTop(true, 'screen-saver');
    }
  }
}
```

- [ ] **Step 5: Create the provider registry `src/main/providers/index.ts`**

```ts
import { createClaudePlugin } from './claude/plugin';
import { createCodexPlugin } from './codex/plugin';
import type { ProviderPlugin } from './types';

/** Add new providers here. Order = order in the pill and panel. */
export function createProviders(): ProviderPlugin[] {
  return [createClaudePlugin(), createCodexPlugin()];
}
```

- [ ] **Step 6: Create the composition root `src/main/app.ts`**

```ts
import { app, ipcMain, powerMonitor, screen, shell } from 'electron';
import { join } from 'node:path';
import { IPC, type DisplayOption, type ProviderOption } from '../shared/ipc';
import { mergeSettings, providerSettings, type Settings, type SettingsPatch } from '../shared/settings-schema';
import { MINUTE } from '../shared/time';
import type { DetectedSource, Snapshot } from '../shared/types';
import { buildProviderView, type IslandView } from '../shared/view-model';
import { listDisplays } from './displays';
import { pickDisplay } from './island-geometry';
import { IslandWindow } from './island-window';
import type { initLog } from './log';
import { createProviders } from './providers';
import { Scheduler, type ScheduledTask } from './scheduler';
import { loadSettings, saveSettings } from './settings';
import { defaultDetectDeps, listCandidateHomes, pickSource } from './sources/detect';
import { loadState, saveState } from './state-file';
import { UsageStore } from './usage-store';
// [task-14] tray + settings window imports
// [task-15] alert imports
// [task-16] fullscreen imports

export interface RunningApp {
  island: IslandWindow;
  scheduler: Scheduler;
}

export async function startApp(log: ReturnType<typeof initLog>): Promise<RunningApp> {
  const userData = app.getPath('userData');
  const settingsFile = join(userData, 'settings.json');
  const stateFile = join(userData, 'state.json');

  let settings: Settings = loadSettings(settingsFile);
  const persisted = loadState(stateFile);
  const store = new UsageStore(persisted.lastGood);
  // [task-15] alert engine
  const plugins = createProviders();
  const detected: Record<string, DetectedSource[]> = {};

  const islandDisplay = () => pickDisplay(listDisplays(), settings.displayId);
  const island = new IslandWindow(islandDisplay);

  async function detectAll(): Promise<void> {
    const candidates = await listCandidateHomes(defaultDetectDeps());
    for (const plugin of plugins) {
      detected[plugin.id] = await plugin.detectSources(candidates).catch((error: unknown) => {
        log.warn(`source detection failed for ${plugin.id}`, error);
        return [];
      });
    }
  }

  const enabledPlugins = () => plugins.filter((plugin) => providerSettings(settings, plugin.id).enabled);

  function view(): IslandView {
    const now = Date.now();
    return {
      generatedAt: now,
      providers: enabledPlugins().map((plugin) =>
        buildProviderView({
          id: plugin.id,
          name: plugin.name,
          shortName: plugin.shortName,
          fromLogs: plugin.fromLogs,
          staleAfterMs: plugin.staleAfterMs,
          entry: store.get(plugin.id),
          now,
          warnPercent: settings.warnPercent,
          criticalPercent: settings.criticalPercent,
        }),
      ),
    };
  }

  const pushView = () => {
    if (!island.win.isDestroyed()) island.win.webContents.send(IPC.viewUpdate, view());
  };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveState(stateFile, { lastGood: store.lastGoodMap(), alertsFired: persisted.alertsFired });
    }, 1000);
  };

  const tasks = (): ScheduledTask[] =>
    enabledPlugins().map((plugin) => ({
      id: plugin.id,
      intervalMs: () => plugin.intervalMs(settings),
      run: async (): Promise<Snapshot> => {
        const now = Date.now();
        const source = pickSource(detected[plugin.id] ?? [], providerSettings(settings, plugin.id).sourceHome);
        if (!source) {
          return { providerId: plugin.id, source: null, status: 'not-found', dataAsOf: now, limits: [], message: plugin.notFoundMessage };
        }
        return plugin.fetch(source, now);
      },
    }));

  function onSnapshot(snapshot: Snapshot, nextRunAt: number): void {
    const { previous } = store.update(snapshot, nextRunAt);
    void previous; // [task-15] evaluate alerts against previous?.lastGood
    if (snapshot.status === 'error') log.warn(`${snapshot.providerId}: ${snapshot.message ?? 'error'}`);
    persist();
    pushView();
  }

  await detectAll();
  const scheduler = new Scheduler(tasks(), onSnapshot);
  scheduler.start();
  setInterval(() => void detectAll(), 5 * MINUTE);
  // Staleness is time-based, so re-send the view even when no fetch happened.
  setInterval(pushView, 30_000);

  function applySettings(next: Settings): Settings {
    const previous = settings;
    settings = next;
    saveSettings(settingsFile, next);
    island.reposition();
    if (JSON.stringify(previous.providers) !== JSON.stringify(next.providers) || previous.claudeRefreshMs !== next.claudeRefreshMs) {
      scheduler.setTasks(tasks());
    }
    // [task-16] apply login item + fullscreen watch
    pushView();
    return settings;
  }

  ipcMain.handle(IPC.viewGet, () => view());
  ipcMain.handle(IPC.refresh, (_event, olderThanMs?: number) => scheduler.refreshNow({ olderThanMs }));
  ipcMain.on(IPC.islandResize, (_event, width: number, height: number) => island.resize(width, height));
  ipcMain.on(IPC.islandSetExpanded, (_event, expanded: boolean) => island.setExpanded(expanded));
  ipcMain.on(IPC.openUsagePage, (_event, providerId: string) => {
    const url = plugins.find((plugin) => plugin.id === providerId)?.usageUrl;
    if (url) void shell.openExternal(url);
  });
  ipcMain.handle(IPC.settingsGet, () => settings);
  ipcMain.handle(IPC.settingsSet, (_event, patch: SettingsPatch) => applySettings(mergeSettings(settings, patch)));
  ipcMain.handle(IPC.providersGet, async (): Promise<ProviderOption[]> => {
    await detectAll();
    return plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      sources: (detected[plugin.id] ?? []).map(({ kind, label, home, lastModifiedMs }) => ({ kind, label, home, lastModifiedMs })),
    }));
  });
  ipcMain.handle(IPC.displaysGet, (): DisplayOption[] => listDisplays().map(({ id, label, primary }) => ({ id, label, primary })));
  // [task-14] openSettings IPC + tray

  screen.on('display-added', () => island.reposition());
  screen.on('display-removed', () => island.reposition());
  screen.on('display-metrics-changed', () => island.reposition());
  powerMonitor.on('resume', () => void scheduler.refreshNow());

  // [task-16] fullscreen watch + login item

  return { island, scheduler };
}
```

- [ ] **Step 7: Replace `src/main/index.ts`**

```ts
import { app } from 'electron';
import { APP_ID } from '../shared/app-id';
import { startApp, type RunningApp } from './app';
import { initLog } from './log';

const log = initLog();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  let running: RunningApp | undefined;

  app.on('second-instance', () => running?.island.show());
  // The app lives in the island and tray; closing windows must not quit it.
  app.on('window-all-closed', () => {});

  app
    .whenReady()
    .then(async () => {
      running = await startApp(log);
    })
    .catch((error: unknown) => {
      log.error('startup failed', error);
      app.quit();
    });
}
```

- [ ] **Step 8: Temporary island renderer showing the raw view**

`src/renderer/island/main.tsx` (Task 13 replaces it):
```tsx
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { IslandView } from '../../shared/view-model';

function Debug() {
  const [view, setView] = useState<IslandView | null>(null);
  useEffect(() => {
    void window.api.getView().then(setView);
    return window.api.onView(setView);
  }, []);
  useEffect(() => window.api.resizeIsland(420, 260), []);
  return (
    <pre style={{ margin: 0, background: '#111', color: '#eee', font: '11px monospace', height: '100vh', overflow: 'auto' }}>
      {JSON.stringify(view?.providers.map((p) => ({ id: p.id, status: p.status, max: p.maxPercent, message: p.message })), null, 2)}
    </pre>
  );
}

createRoot(document.getElementById('root')!).render(<Debug />);
```

- [ ] **Step 9: Verify the typecheck, tests and build in WSL**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 10: Run on Windows and check the data flow**

Run: `scripts/sync-to-windows.sh`, then in PowerShell: `cd C:\dev\ai-usage; npm install; npm run dev`.
Expected: a borderless 420×260 box at the top-center of the primary display, always on top, with no taskbar button. Within a few seconds it lists `claude` with `status: "ok"` and a `max` percent, plus `codex` with `ok` (or `not-found` if Codex was never used on that side). Confirm the log file `%APPDATA%\ai-usage\logs\main.log` has no `Bearer`/`sk-` strings: `Select-String -Path "$env:APPDATA\ai-usage\logs\main.log" -Pattern 'Bearer |sk-ant'` prints nothing.

- [ ] **Step 11: Commit**

```bash
git add src/shared/ipc.ts src/preload/index.ts src/renderer/env.d.ts src/renderer/island/main.tsx src/main
git commit -m "feat: wire island window, scheduler, store and IPC in the main process"
```

---
### Task 13: Island UI (pill, panel, limit rows, status lines)

**Files:**
- Create: `src/renderer/island/Pill.tsx`, `LimitRow.tsx`, `StatusLine.tsx`, `Panel.tsx`, `IslandApp.tsx`, `island.css`
- Create: `src/renderer/island/test-fixtures.ts` (shared test data)
- Modify: `src/renderer/island/main.tsx` (replace the Task 12 debug view)
- Test: `src/renderer/island/Pill.test.tsx`, `Panel.test.tsx`, `IslandApp.test.tsx`

**Interfaces:**
- Consumes: `IslandView`, `ProviderView`, `LimitView` (Task 9); `formatReset`, `formatDuration`, `formatPercent` (Task 9); `Api` (Task 12).
- Produces:
  ```tsx
  function Pill(props: { providers: ProviderView[]; expanded: boolean; onClick(): void }): JSX.Element;
  function LimitRow(props: { limit: LimitView; now: number; dim: boolean }): JSX.Element;
  function statusText(provider: ProviderView, now: number): string;
  function StatusLine(props: { provider: ProviderView; now: number; onOpenSettings(): void }): JSX.Element;
  function footerText(providers: ProviderView[], now: number): string;
  function Panel(props: { view: IslandView; now: number; onRefresh(): void; onOpenSettings(): void; onOpenUsage(id: string): void }): JSX.Element;
  function IslandApp(props: { api?: Api; clock?: () => number }): JSX.Element;
  ```

The tests below share one fixture module. Create `src/renderer/island/test-fixtures.ts` first:
```ts
import type { ProviderView } from '../../shared/view-model';

export const now = Date.UTC(2026, 8, 15, 17, 0);

export const claude: ProviderView = {
  id: 'claude', name: 'Claude', shortName: 'Claude', plan: 'Max (5x)',
  source: { kind: 'wsl', label: 'WSL · Ubuntu', home: '/home/me' },
  status: 'ok', dataAsOf: now - 60_000, fromLogs: false, maxPercent: 73, level: 'normal',
  limits: [
    { id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: now + 2 * 3_600_000 + 8 * 60_000, level: 'normal' },
    { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: now + 3 * 86_400_000, level: 'normal' },
  ],
};

export const codex: ProviderView = {
  id: 'codex', name: 'ChatGPT (Codex)', shortName: 'Codex', plan: 'Pro Lite',
  source: { kind: 'windows', label: 'Windows', home: 'C:\\Users\\Raymond' },
  status: 'ok', dataAsOf: now - 3 * 3_600_000, fromLogs: true, maxPercent: 97, level: 'critical',
  limits: [{ id: 'codex-10080m', label: 'Weekly limit', usedPercent: 97, resetsAt: now + 2 * 86_400_000, level: 'critical' }],
};
```

- [ ] **Step 1: Write the failing Pill tests**

`src/renderer/island/Pill.test.tsx`:
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProviderView } from '../../shared/view-model';
import { Pill } from './Pill';

import { claude, codex, now } from './test-fixtures';

describe('Pill', () => {
  it('shows each provider short name with its highest percent and state', () => {
    render(<Pill providers={[claude, codex]} expanded={false} onClick={() => {}} />);
    expect(screen.getByTestId('pill-claude').textContent).toBe('Claude 73%');
    expect(screen.getByTestId('pill-claude').dataset.state).toBe('normal');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('critical');
  });

  it('marks stale and no-data providers', () => {
    const stale: ProviderView = { ...claude, status: 'auth-expired' };
    const empty: ProviderView = { ...codex, status: 'not-found', limits: [], maxPercent: null, level: 'normal' };
    render(<Pill providers={[stale, empty]} expanded={false} onClick={() => {}} />);
    expect(screen.getByTestId('pill-claude').dataset.state).toBe('stale');
    expect(screen.getByTestId('pill-codex').dataset.state).toBe('no-data');
    expect(screen.getByTestId('pill-codex').textContent).toBe('Codex');
  });

  it('calls onClick and exposes the expanded state', () => {
    const onClick = vi.fn();
    render(<Pill providers={[claude]} expanded onClick={onClick} />);
    const button = screen.getByRole('button', { name: /usage details/i });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/renderer/island/Pill.test.tsx`
Expected: FAIL with `Failed to resolve import "./Pill"`.

- [ ] **Step 3: Implement `Pill.tsx`**

```tsx
import { ClockAlert, CloudOff, Gauge, TriangleAlert } from 'lucide-react';
import type { ProviderView } from '../../shared/view-model';

const PROVIDER_COLORS: Record<string, string> = { claude: '#d97757', codex: '#10a37f' };

function segmentState(provider: ProviderView): 'no-data' | 'stale' | ProviderView['level'] {
  if (provider.maxPercent === null) return 'no-data';
  if (provider.status !== 'ok') return 'stale';
  return provider.level;
}

function SegmentIcon({ provider, state }: { provider: ProviderView; state: ReturnType<typeof segmentState> }) {
  if (state === 'no-data') return <CloudOff size={12} aria-hidden />;
  if (state === 'stale') return <ClockAlert size={12} aria-hidden />;
  if (state !== 'normal') return <TriangleAlert size={12} aria-hidden />;
  return <span className="dot" style={{ background: PROVIDER_COLORS[provider.id] ?? '#8a8a8a' }} aria-hidden />;
}

export function Pill({ providers, expanded, onClick }: { providers: ProviderView[]; expanded: boolean; onClick(): void }) {
  return (
    <button type="button" className="pill" aria-label="Show usage details" aria-expanded={expanded} onClick={onClick}>
      {providers.length === 0 && (
        <span className="pill-seg state-stale">
          <Gauge size={12} aria-hidden />
          AI Usage
        </span>
      )}
      {providers.map((provider) => {
        const state = segmentState(provider);
        return (
          <span key={provider.id} className={`pill-seg state-${state}`} data-testid={`pill-${provider.id}`} data-state={state}>
            <SegmentIcon provider={provider} state={state} />
            {provider.maxPercent === null ? provider.shortName : `${provider.shortName} ${Math.round(provider.maxPercent)}%`}
          </span>
        );
      })}
    </button>
  );
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/renderer/island/Pill.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing Panel tests**

`src/renderer/island/Panel.test.tsx`:
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProviderView } from '../../shared/view-model';
import { Panel, footerText } from './Panel';
import { statusText } from './StatusLine';

import { claude, codex, now } from './test-fixtures';

const handlers = () => ({ onRefresh: vi.fn(), onOpenSettings: vi.fn(), onOpenUsage: vi.fn() });

describe('Panel', () => {
  it('renders a group per provider with plan, source and limit rows', () => {
    render(<Panel view={{ providers: [claude, codex], generatedAt: now }} now={now} {...handlers()} />);
    expect(screen.getByText('Claude · Max (5x)')).toBeTruthy();
    expect(screen.getByText('WSL · Ubuntu')).toBeTruthy();
    expect(screen.getByText('ChatGPT (Codex) · Pro Lite')).toBeTruthy();
    const row = screen.getByTestId('limit-five_hour');
    expect(row.textContent).toContain('5-hour limit');
    expect(row.textContent).toContain('Resets in 2 hr 8 min');
    expect(row.textContent).toContain('73%');
    expect(screen.getByTestId('limit-codex-10080m').querySelector('.fill')?.className).toContain('level-critical');
  });

  it('wires the header and footer buttons', () => {
    const h = handlers();
    render(<Panel view={{ providers: [claude], generatedAt: now }} now={now} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Claude usage page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(h.onOpenUsage).toHaveBeenCalledWith('claude');
    expect(h.onRefresh).toHaveBeenCalledOnce();
    expect(h.onOpenSettings).toHaveBeenCalledOnce();
  });

  it('shows a status line and dims rows for a non-ok provider', () => {
    const expired: ProviderView = { ...claude, status: 'auth-expired', message: 'Login expired · run claude to refresh' };
    render(<Panel view={{ providers: [expired], generatedAt: now }} now={now} {...handlers()} />);
    expect(screen.getByRole('status').textContent).toContain('Login expired · run claude to refresh');
    expect(screen.getByTestId('limit-five_hour').className).toContain('dim');
  });

  it('hides the percent for a window that has reset', () => {
    const reset: ProviderView = { ...codex, limits: [{ ...codex.limits[0], usedPercent: null, resetsAt: now - 1, level: 'normal' }] };
    render(<Panel view={{ providers: [reset], generatedAt: now }} now={now} {...handlers()} />);
    const row = screen.getByTestId('limit-codex-10080m');
    expect(row.textContent).toContain('Reset since last seen');
    expect(row.textContent).not.toContain('%');
  });
});

describe('statusText', () => {
  it('adds the retry countdown to errors', () => {
    expect(statusText({ ...claude, status: 'error', message: "Couldn't reach Anthropic", retryAt: now + 120_000 }, now)).toBe(
      "Couldn't reach Anthropic · retrying in 2 min",
    );
  });

  it('describes stale data by age', () => {
    expect(statusText({ ...claude, status: 'stale', dataAsOf: now - 15 * 60_000 }, now)).toBe('Data is 15 min old');
    expect(statusText({ ...claude, status: 'stale', limits: [], dataAsOf: null, message: 'Checking…' }, now)).toBe('Checking…');
  });
});

describe('footerText', () => {
  it('combines the live update time with log ages', () => {
    expect(footerText([claude, codex], now)).toBe('Updated 1 min ago · Codex from logs, 3 hr old');
  });

  it('waits when nothing has arrived yet', () => {
    expect(footerText([{ ...claude, dataAsOf: null }], now)).toBe('Waiting for data');
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/renderer/island/Panel.test.tsx`
Expected: FAIL with `Failed to resolve import "./Panel"`.

- [ ] **Step 7: Implement `LimitRow.tsx`, `StatusLine.tsx`, `Panel.tsx`**

`src/renderer/island/LimitRow.tsx`:
```tsx
import { formatPercent, formatReset } from '../../shared/format';
import type { LimitView } from '../../shared/view-model';

export function LimitRow({ limit, now, dim }: { limit: LimitView; now: number; dim: boolean }) {
  const percent = limit.usedPercent;
  return (
    <div className={dim ? 'row dim' : 'row'} data-testid={`limit-${limit.id}`}>
      <div className="row-top">
        <b>{limit.label}</b>
        <span className="row-meta">
          {formatReset(limit.resetsAt, now)}
          {percent !== null && <span className="pct">{formatPercent(percent)}</span>}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-label={limit.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0}>
        <i className={`fill level-${limit.level}`} style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
      </div>
    </div>
  );
}
```

`src/renderer/island/StatusLine.tsx`:
```tsx
import { ClockAlert, CloudOff, TriangleAlert } from 'lucide-react';
import { formatDuration } from '../../shared/format';
import type { ProviderView } from '../../shared/view-model';

export function statusText(provider: ProviderView, now: number): string {
  switch (provider.status) {
    case 'error': {
      const message = provider.message ?? 'Update failed';
      return provider.retryAt === undefined ? message : `${message} · retrying in ${formatDuration(Math.max(0, provider.retryAt - now))}`;
    }
    case 'stale':
      return provider.limits.length > 0 && provider.dataAsOf !== null
        ? `Data is ${formatDuration(now - provider.dataAsOf)} old`
        : (provider.message ?? 'Checking…');
    default:
      return provider.message ?? '';
  }
}

export function StatusLine({ provider, now, onOpenSettings }: { provider: ProviderView; now: number; onOpenSettings(): void }) {
  const Icon = provider.status === 'not-found' ? CloudOff : provider.status === 'stale' ? ClockAlert : TriangleAlert;
  return (
    <div className={`status status-${provider.status}`} role="status">
      <Icon size={12} aria-hidden />
      <span>{statusText(provider, now)}</span>
      {provider.status === 'not-found' && (
        <button type="button" className="link" onClick={onOpenSettings}>
          Choose source
        </button>
      )}
    </div>
  );
}
```

`src/renderer/island/Panel.tsx`:
```tsx
import { ArrowUpRight, Clock, Monitor, RefreshCw, Settings, SquareTerminal } from 'lucide-react';
import { formatDuration } from '../../shared/format';
import type { IslandView, ProviderView } from '../../shared/view-model';
import { LimitRow } from './LimitRow';
import { StatusLine } from './StatusLine';

export function footerText(providers: ProviderView[], now: number): string {
  const live = providers.filter((p) => !p.fromLogs && p.dataAsOf !== null).map((p) => p.dataAsOf as number);
  const logs = providers.filter((p) => p.fromLogs && p.dataAsOf !== null);
  const parts: string[] = [];
  if (live.length > 0) parts.push(`Updated ${formatDuration(now - Math.max(...live))} ago`);
  for (const p of logs) parts.push(`${p.shortName} from logs, ${formatDuration(now - (p.dataAsOf as number))} old`);
  return parts.length > 0 ? parts.join(' · ') : 'Waiting for data';
}

interface PanelProps {
  view: IslandView;
  now: number;
  onRefresh(): void;
  onOpenSettings(): void;
  onOpenUsage(providerId: string): void;
}

export function Panel({ view, now, onRefresh, onOpenSettings, onOpenUsage }: PanelProps) {
  return (
    <div className="panel" role="dialog" aria-label="Plan usage limits">
      {view.providers.map((provider, index) => (
        <section key={provider.id} className="group">
          {index > 0 && <hr className="sep" />}
          <header className="group-head">
            <span className="group-title">
              <span>{[provider.name, provider.plan].filter(Boolean).join(' · ')}</span>
              {provider.source && (
                <span className="source">
                  {provider.source.kind === 'wsl' ? <SquareTerminal size={12} aria-hidden /> : <Monitor size={12} aria-hidden />}
                  <span>{provider.source.label}</span>
                </span>
              )}
            </span>
            <button type="button" className="icon-btn" aria-label={`Open ${provider.name} usage page`} onClick={() => onOpenUsage(provider.id)}>
              <ArrowUpRight size={14} aria-hidden />
            </button>
          </header>
          {provider.status !== 'ok' && <StatusLine provider={provider} now={now} onOpenSettings={onOpenSettings} />}
          {provider.limits.map((limit) => (
            <LimitRow key={limit.id} limit={limit} now={now} dim={provider.status !== 'ok'} />
          ))}
        </section>
      ))}
      <footer className="foot">
        <span className="foot-text">
          <Clock size={12} aria-hidden />
          {footerText(view.providers, now)}
        </span>
        <span className="btns">
          <button type="button" className="icon-btn" aria-label="Refresh now" onClick={onRefresh}>
            <RefreshCw size={14} aria-hidden />
          </button>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
            <Settings size={14} aria-hidden />
          </button>
        </span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/renderer/island/Panel.test.tsx`
Expected: PASS.

- [ ] **Step 9: Write the failing IslandApp tests**

`src/renderer/island/IslandApp.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../../shared/ipc';
import type { IslandView, ProviderView } from '../../shared/view-model';
import { IslandApp } from './IslandApp';

import { claude, codex, now } from './test-fixtures';

function fakeApi(view: IslandView) {
  const listeners = { view: [] as ((v: IslandView) => void)[], collapse: [] as (() => void)[], expand: [] as (() => void)[] };
  const api: Api = {
    getView: vi.fn(async () => view),
    onView: (l) => (listeners.view.push(l), () => {}),
    refresh: vi.fn(async () => {}),
    resizeIsland: vi.fn(),
    setExpanded: vi.fn(),
    onCollapse: (l) => (listeners.collapse.push(l), () => {}),
    onExpand: (l) => (listeners.expand.push(l), () => {}),
    openUsagePage: vi.fn(),
    openSettings: vi.fn(),
    getSettings: vi.fn(),
    setSettings: vi.fn(),
    getProviders: vi.fn(),
    getDisplays: vi.fn(),
  };
  return { api, listeners };
}

describe('IslandApp', () => {
  it('expands on click, refreshes stale data and collapses on Escape', async () => {
    const { api } = fakeApi({ providers: [claude, codex], generatedAt: now });
    render(<IslandApp api={api} clock={() => now} />);
    await act(async () => {});

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /usage details/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(api.setExpanded).toHaveBeenLastCalledWith(true);
    expect(api.refresh).toHaveBeenCalledWith(30_000);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.setExpanded).toHaveBeenLastCalledWith(false);
  });

  it('collapses when the main process reports blur and expands on request', async () => {
    const { api, listeners } = fakeApi({ providers: [claude], generatedAt: now });
    render(<IslandApp api={api} clock={() => now} />);
    await act(async () => {});

    act(() => listeners.expand.forEach((l) => l()));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => listeners.collapse.forEach((l) => l()));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-renders when a new view is pushed', async () => {
    const { api, listeners } = fakeApi({ providers: [claude], generatedAt: now });
    render(<IslandApp api={api} clock={() => now} />);
    await act(async () => {});
    const updated: ProviderView = { ...claude, maxPercent: 88, level: 'warn' };
    act(() => listeners.view.forEach((l) => l({ providers: [updated], generatedAt: now + 1 })));
    expect(screen.getByTestId('pill-claude').textContent).toBe('Claude 88%');
  });
});
```

- [ ] **Step 10: Run them to verify they fail**

Run: `npx vitest run src/renderer/island/IslandApp.test.tsx`
Expected: FAIL with `Failed to resolve import "./IslandApp"`.

- [ ] **Step 11: Implement `IslandApp.tsx`, `island.css` and the real `main.tsx`**

`src/renderer/island/IslandApp.tsx`:
```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Api } from '../../shared/ipc';
import type { IslandView } from '../../shared/view-model';
import { Panel } from './Panel';
import { Pill } from './Pill';

export function IslandApp({ api = window.api, clock = Date.now }: { api?: Api; clock?: () => number }) {
  const [view, setView] = useState<IslandView | null>(null);
  const [expanded, setExpandedState] = useState(false);
  const [now, setNow] = useState(clock);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receive = (next: IslandView) => {
      setView(next);
      setNow(clock());
    };
    void api.getView().then(receive);
    return api.onView(receive);
  }, [api, clock]);

  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), 30_000);
    return () => clearInterval(timer);
  }, [clock]);

  const setExpanded = useCallback(
    (next: boolean) => {
      setExpandedState(next);
      api.setExpanded(next);
      if (next) void api.refresh(30_000);
    },
    [api],
  );

  useEffect(() => api.onCollapse(() => setExpanded(false)), [api, setExpanded]);
  useEffect(() => api.onExpand(() => setExpanded(true)), [api, setExpanded]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setExpanded]);

  // The window is sized to the content: the pill alone when collapsed, pill + panel when expanded.
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const report = () => api.resizeIsland(element.offsetWidth, element.offsetHeight);
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [api]);

  return (
    <div ref={rootRef} className="island">
      <Pill providers={view?.providers ?? []} expanded={expanded} onClick={() => setExpanded(!expanded)} />
      {expanded && view && (
        <Panel
          view={view}
          now={now}
          onRefresh={() => void api.refresh()}
          onOpenSettings={() => api.openSettings()}
          onOpenUsage={(id) => api.openUsagePage(id)}
        />
      )}
    </div>
  );
}
```

`src/renderer/island/island.css`:
```css
:root {
  color-scheme: dark;
  font-family: 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  --warn: #f5b041;
  --critical: #ff6b6b;
  --bar: #2f7de1;
}

html,
body {
  margin: 0;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

.island {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 14px 18px; /* room for the panel shadow inside the transparent window */
}

button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.pill {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 5px 14px 6px;
  border: 0;
  border-radius: 0 0 14px 14px;
  background: #0b0b0b;
  color: #eee;
  box-shadow: 0 4px 12px rgb(0 0 0 / 40%);
  white-space: nowrap;
}

.pill-seg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.state-warn { color: var(--warn); }
.state-critical { color: var(--critical); }
.state-stale,
.state-no-data { color: #777; }

.panel {
  width: 340px;
  box-sizing: border-box;
  padding: 12px 14px 10px;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  background: #1f1f1f;
  color: #9a9a9a;
  box-shadow: 0 10px 30px rgb(0 0 0 / 50%);
  animation: drop 140ms ease-out;
}

@keyframes drop {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.sep { border: 0; border-top: 1px solid #333; margin: 10px 0; }

.group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.group-title,
.source,
.status,
.foot-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.source::before { content: '·'; margin-right: 1px; }

.icon-btn {
  display: inline-flex;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #aaa;
}

.icon-btn:hover { background: #2c2c2c; color: #fff; }

.status { margin: 4px 0 6px; color: #bbb; }
.status-error,
.status-auth-expired { color: var(--warn); }

.link { border: 0; background: none; padding: 0; color: #6ea8fe; text-decoration: underline; }

.row { margin: 9px 0; }
.row.dim { opacity: 0.55; }
.row-top { display: flex; justify-content: space-between; gap: 8px; }
.row-top b { color: #eee; font-weight: 600; }
.pct { margin-left: 8px; }

.bar { height: 5px; margin-top: 4px; border-radius: 3px; background: #333; }
.fill { display: block; height: 100%; border-radius: 3px; background: var(--bar); transition: width 300ms ease; }
.fill.level-warn { background: var(--warn); }
.fill.level-critical { background: var(--critical); }

.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  color: #666;
  font-size: 11px;
}

.btns { display: flex; gap: 2px; }
```

`src/renderer/island/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { IslandApp } from './IslandApp';
import './island.css';

createRoot(document.getElementById('root')!).render(<IslandApp />);
```

- [ ] **Step 12: Run all renderer tests, typecheck and build**

Run: `npx vitest run src/renderer && npm run typecheck && npm run build`
Expected: PASS; no type errors; build succeeds.

- [ ] **Step 13: Check on Windows**

Run: `scripts/sync-to-windows.sh`, then `npm run dev` in `C:\dev\ai-usage`.
Expected:
- A black pill hangs from the top-center edge showing `● Claude NN%  ● Codex NN%`, and the rest of the screen stays clickable.
- Clicking the pill drops the panel, matching the approved mockup: plan and source headers, rows with reset text, bars and the footer.
- Clicking the pill again, pressing Esc, or clicking another app collapses it.
- The `arrow-up-right` button opens the provider's usage page in the browser.

- [ ] **Step 14: Commit**

```bash
git add src/renderer/island
git commit -m "feat(island): add pill and expandable usage panel UI"
```

---
### Task 14: Tray icon, settings window and settings UI

**Files:**
- Create: `scripts/make-icons.mjs`, `resources/tray.ico` and `build/icon.ico` (generated, committed)
- Create: `src/main/tray.ts`, `src/main/settings-window.ts`
- Create: `src/renderer/settings.html`, `src/renderer/settings/main.tsx`, `SettingsApp.tsx`, `NumberInput.tsx`, `settings.css`
- Modify: `electron.vite.config.ts` (add the settings page input)
- Modify: `src/main/app.ts` (replace the `[task-14]` markers)
- Test: `src/renderer/settings/SettingsApp.test.tsx`

**Interfaces:**
- Consumes: `Api`, `ProviderOption`, `DisplayOption` (Task 12); `Settings`, `SettingsPatch`, `DEFAULT_SETTINGS` (Task 2); `loadRenderer` (Task 12); `IslandWindow` (Task 12).
- Produces:
  ```ts
  interface TrayActions { toggleIsland(): void; isIslandVisible(): boolean; refresh(): void; openSettings(): void;
                          getOpenAtLogin(): boolean; setOpenAtLogin(value: boolean): void; quit(): void }
  function createTray(iconPath: string, actions: TrayActions): { tray: Tray; rebuild(): void };
  function openSettingsWindow(): void;
  function SettingsApp(props: { api?: Api }): JSX.Element;
  function NumberInput(props: { value: number; min: number; max: number; label: string; onCommit(value: number): void }): JSX.Element;
  ```

- [ ] **Step 1: Generate icons from Lucide `gauge`**

`scripts/make-icons.mjs`:
```js
// Renders the Lucide "gauge" icon into the app icon (build/icon.ico) and tray icon (resources/tray.ico).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

// Lucide "gauge" (ISC license) paths.
const GAUGE = '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>';

function svg(size, { background, stroke, strokeWidth }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5" fill="${background}"/>
    <g transform="translate(3 3) scale(0.75)" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${GAUGE}</g>
  </svg>`);
}

async function ico(file, sizes, style) {
  const dir = mkdtempSync(join(tmpdir(), 'icons-'));
  try {
    const pngs = [];
    for (const size of sizes) {
      const png = join(dir, `${size}.png`);
      writeFileSync(png, await sharp(svg(size, style)).png().toBuffer());
      pngs.push(png);
    }
    writeFileSync(file, await pngToIco(pngs));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

mkdirSync('build', { recursive: true });
mkdirSync('resources', { recursive: true });
await ico('build/icon.ico', [16, 24, 32, 48, 64, 128, 256], { background: '#0b0b0b', stroke: '#2f7de1', strokeWidth: 2.2 });
// A dark rounded square keeps the white glyph visible on both light and dark taskbars.
await ico('resources/tray.ico', [16, 20, 24, 32, 48], { background: '#111111', stroke: '#ffffff', strokeWidth: 2.6 });
console.log('wrote build/icon.ico and resources/tray.ico');
```
Run: `npm run icons && ls -l build/icon.ico resources/tray.ico`
Expected: `wrote build/icon.ico and resources/tray.ico`, and both files are non-empty.

- [ ] **Step 2: Write the failing settings UI tests**

`src/renderer/settings/SettingsApp.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../../shared/ipc';
import { DEFAULT_SETTINGS, type SettingsPatch } from '../../shared/settings-schema';
import { SettingsApp } from './SettingsApp';

function fakeApi(setSettings: Api['setSettings'] = async (patch: SettingsPatch) => ({ ...DEFAULT_SETTINGS, ...patch })) {
  return {
    getView: vi.fn(),
    onView: vi.fn(),
    refresh: vi.fn(),
    resizeIsland: vi.fn(),
    setExpanded: vi.fn(),
    onCollapse: vi.fn(),
    onExpand: vi.fn(),
    openUsagePage: vi.fn(),
    openSettings: vi.fn(),
    getSettings: vi.fn(async () => DEFAULT_SETTINGS),
    setSettings: vi.fn(setSettings),
    getProviders: vi.fn(async () => [
      { id: 'claude', name: 'Claude', sources: [{ kind: 'wsl' as const, label: 'WSL · Ubuntu', home: '\\\\wsl.localhost\\Ubuntu\\home\\me', lastModifiedMs: 2 }] },
      { id: 'codex', name: 'ChatGPT (Codex)', sources: [] },
    ]),
    getDisplays: vi.fn(async () => [
      { id: 1, label: 'Display 1', primary: true },
      { id: 2, label: 'Display 2', primary: false },
    ]),
  } satisfies Api;
}

async function renderSettings(api: Api) {
  render(<SettingsApp api={api} />);
  await act(async () => {});
}

describe('SettingsApp', () => {
  it('toggles a provider', async () => {
    const api = fakeApi();
    await renderSettings(api);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('ChatGPT (Codex)'));
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({
      providers: { ...DEFAULT_SETTINGS.providers, codex: { enabled: false, sourceHome: null } },
    });
  });

  it('picks a provider source', async () => {
    const api = fakeApi();
    await renderSettings(api);

    fireEvent.change(screen.getByLabelText('Claude source'), { target: { value: '\\\\wsl.localhost\\Ubuntu\\home\\me' } });
    expect(api.setSettings).toHaveBeenLastCalledWith({
      providers: { ...DEFAULT_SETTINGS.providers, claude: { enabled: true, sourceHome: '\\\\wsl.localhost\\Ubuntu\\home\\me' } },
    });
    expect(screen.getByText('Not found on Windows or running WSL distros.')).toBeTruthy();
  });

  it('saves display, toggles and minutes', async () => {
    const api = fakeApi();
    await renderSettings(api);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Display'), { target: { value: '2' } });
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ displayId: 2 });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Hide when a fullscreen app is in front'));
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ hideInFullscreen: false });

    const minutes = screen.getByLabelText('Check Claude every (minutes)');
    fireEvent.change(minutes, { target: { value: '5' } });
    await act(async () => {
      fireEvent.blur(minutes);
    });
    expect(api.setSettings).toHaveBeenLastCalledWith({ claudeRefreshMs: 300_000 });
  });

  it('shows the error when saving fails', async () => {
    const api = fakeApi(async () => {
      throw new Error('Warning threshold must be below the critical threshold');
    });
    await renderSettings(api);
    const warn = screen.getByLabelText('Warning at (%)');
    fireEvent.change(warn, { target: { value: '99' } });
    await act(async () => {
      fireEvent.blur(warn);
    });
    expect(screen.getByRole('alert').textContent).toContain('Warning threshold must be below the critical threshold');
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/renderer/settings/SettingsApp.test.tsx`
Expected: FAIL with `Failed to resolve import "./SettingsApp"`.

- [ ] **Step 4: Implement the settings renderer**

`src/renderer/settings/NumberInput.tsx`:
```tsx
import { useEffect, useId, useState } from 'react';

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onCommit(value: number): void;
}

/** Commits on blur or Enter so half-typed numbers are never saved. */
export function NumberInput({ value, min, max, label, onCommit }: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed === value) {
      setDraft(String(value));
      return;
    }
    onCommit(Math.min(max, Math.max(min, Math.round(parsed))));
  };

  return (
    <span className="number">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
      />
    </span>
  );
}
```

`src/renderer/settings/SettingsApp.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { Api, DisplayOption, ProviderOption } from '../../shared/ipc';
import { providerSettings, type Settings, type SettingsPatch } from '../../shared/settings-schema';
import { NumberInput } from './NumberInput';

export function SettingsApp({ api = window.api }: { api?: Api }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [displays, setDisplays] = useState<DisplayOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.getSettings(), api.getProviders(), api.getDisplays()]).then(([s, p, d]) => {
      setSettings(s);
      setProviders(p);
      setDisplays(d);
    });
  }, [api]);

  if (!settings) return <p className="loading">Loading…</p>;

  const save = async (patch: SettingsPatch) => {
    try {
      setSettings(await api.setSettings(patch));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveProvider = (id: string, change: Partial<Settings['providers'][string]>) =>
    save({ providers: { ...settings.providers, [id]: { ...providerSettings(settings, id), ...change } } });

  return (
    <main className="settings">
      <h1>AI Usage settings</h1>

      <section>
        <h2>Providers</h2>
        {providers.map((provider) => {
          const current = providerSettings(settings, provider.id);
          return (
            <fieldset key={provider.id}>
              <label className="check">
                <input type="checkbox" checked={current.enabled} onChange={(e) => void saveProvider(provider.id, { enabled: e.target.checked })} />
                {provider.name}
              </label>
              <div className="field">
                <span>Source</span>
                <select
                  aria-label={`${provider.name} source`}
                  value={current.sourceHome ?? ''}
                  onChange={(e) => void saveProvider(provider.id, { sourceHome: e.target.value || null })}
                >
                  <option value="">Automatic (most recently used)</option>
                  {provider.sources.map((source) => (
                    <option key={source.home} value={source.home}>
                      {source.label} — {source.home}
                    </option>
                  ))}
                </select>
              </div>
              {provider.sources.length === 0 && <p className="hint">Not found on Windows or running WSL distros.</p>}
            </fieldset>
          );
        })}
      </section>

      <section>
        <h2>Island</h2>
        <div className="field">
          <span>Display</span>
          <select
            aria-label="Display"
            value={settings.displayId ?? ''}
            onChange={(e) => void save({ displayId: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Primary display</option>
            {displays.map((display) => (
              <option key={display.id} value={display.id}>
                {display.label}
                {display.primary ? ' (primary)' : ''}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.hideInFullscreen} onChange={(e) => void save({ hideInFullscreen: e.target.checked })} />
          Hide when a fullscreen app is in front
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.openAtLogin} onChange={(e) => void save({ openAtLogin: e.target.checked })} />
          Start with Windows
        </label>
      </section>

      <section>
        <h2>Alerts</h2>
        <label className="check">
          <input type="checkbox" checked={settings.alertsEnabled} onChange={(e) => void save({ alertsEnabled: e.target.checked })} />
          Show notifications
        </label>
        <NumberInput label="Warning at (%)" value={settings.warnPercent} min={1} max={99} onCommit={(v) => void save({ warnPercent: v })} />
        <NumberInput label="Critical at (%)" value={settings.criticalPercent} min={2} max={100} onCommit={(v) => void save({ criticalPercent: v })} />
      </section>

      <section>
        <h2>Refresh</h2>
        <NumberInput
          label="Check Claude every (minutes)"
          value={settings.claudeRefreshMs / 60_000}
          min={1}
          max={60}
          onCommit={(v) => void save({ claudeRefreshMs: v * 60_000 })}
        />
        <p className="hint">Codex is read from local logs every 30 seconds.</p>
      </section>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  );
}
```

`src/renderer/settings/settings.css`:
```css
:root {
  color-scheme: light dark;
  font-family: 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
}

body { margin: 0; }

.settings { padding: 16px 20px 24px; }
h1 { font-size: 18px; margin: 0 0 12px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; margin: 18px 0 8px; }
fieldset { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 8px; margin: 0 0 10px; padding: 8px 12px; }
.check { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.field,
.number { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 6px 0; }
select { max-width: 280px; }
input[type='number'] { width: 70px; }
.hint { margin: 4px 0; opacity: 0.7; font-size: 12px; }
.error { color: #d9534f; }
```

`src/renderer/settings/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { SettingsApp } from './SettingsApp';
import './settings.css';

createRoot(document.getElementById('root')!).render(<SettingsApp />);
```

`src/renderer/settings.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    />
    <title>AI Usage settings</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/settings/main.tsx"></script>
  </body>
</html>
```

In `electron.vite.config.ts`, replace:
```ts
          island: resolve(__dirname, 'src/renderer/island.html'),
```
with:
```ts
          island: resolve(__dirname, 'src/renderer/island.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html'),
```

- [ ] **Step 5: Run the settings tests to verify they pass**

Run: `npx vitest run src/renderer/settings`
Expected: PASS (4 tests).

- [ ] **Step 6: Create `src/main/settings-window.ts` and `src/main/tray.ts`**

`src/main/settings-window.ts`:
```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { loadRenderer } from './renderer-url';

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'AI Usage settings',
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  settingsWindow.once('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  loadRenderer(settingsWindow, 'settings');
}
```

`src/main/tray.ts`:
```ts
import { Menu, Tray } from 'electron';
import { PRODUCT_NAME } from '../shared/app-id';

export interface TrayActions {
  toggleIsland(): void;
  isIslandVisible(): boolean;
  refresh(): void;
  openSettings(): void;
  getOpenAtLogin(): boolean;
  setOpenAtLogin(value: boolean): void;
  quit(): void;
}

export function createTray(iconPath: string, actions: TrayActions): { tray: Tray; rebuild(): void } {
  const tray = new Tray(iconPath);
  tray.setToolTip(PRODUCT_NAME);

  const rebuild = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: actions.isIslandVisible() ? 'Hide island' : 'Show island',
          click: () => {
            actions.toggleIsland();
            rebuild();
          },
        },
        { label: 'Refresh now', click: () => actions.refresh() },
        { label: 'Settings…', click: () => actions.openSettings() },
        { type: 'separator' },
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: actions.getOpenAtLogin(),
          click: (item) => actions.setOpenAtLogin(item.checked),
        },
        { type: 'separator' },
        { label: 'Quit', click: () => actions.quit() },
      ]),
    );

  rebuild();
  tray.on('click', () => {
    actions.toggleIsland();
    rebuild();
  });
  return { tray, rebuild };
}
```

- [ ] **Step 7: Wire the tray and settings window into `app.ts`**

Replace `// [task-14] tray + settings window imports` with:
```ts
import trayIcon from '../../resources/tray.ico?asset';
import { openSettingsWindow } from './settings-window';
import { createTray } from './tray';
```

Replace `// [task-14] openSettings IPC + tray` with:
```ts
  ipcMain.on(IPC.openSettings, () => openSettingsWindow());

  const trayHandle = createTray(trayIcon, {
    toggleIsland: () => island.toggleUserHidden(),
    isIslandVisible: () => island.isUserVisible(),
    refresh: () => void scheduler.refreshNow(),
    openSettings: () => openSettingsWindow(),
    getOpenAtLogin: () => settings.openAtLogin,
    setOpenAtLogin: (value) => {
      applySettings(mergeSettings(settings, { openAtLogin: value }));
    },
    quit: () => app.quit(),
  });
```

In `applySettings`, directly before `pushView();`, add:
```ts
    trayHandle.rebuild();
```
`trayHandle` is declared after `applySettings` in the file, but `applySettings` only runs from IPC or tray clicks, after startup has finished, so the reference is always initialized by then.

Change the `RunningApp` interface and return value so the tray isn't garbage-collected:
```ts
export interface RunningApp {
  island: IslandWindow;
  scheduler: Scheduler;
  tray: ReturnType<typeof createTray>;
}
```
```ts
  return { island, scheduler, tray: trayHandle };
```

- [ ] **Step 8: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS; `out/renderer/settings.html` exists.

- [ ] **Step 9: Check on Windows**

Run: `scripts/sync-to-windows.sh`, then `npm run dev`.
Expected:
- A gauge tray icon appears.
- Its right-click menu shows Hide island / Refresh now / Settings… / Start with Windows / Quit. Left-click toggles the island.
- Settings… (or the panel's gear button) opens the settings window.
- Unticking ChatGPT (Codex) removes it from the pill within a second.
- Switching Display moves the island.
- Entering Warning 99 shows the red validation error.

- [ ] **Step 10: Commit**

```bash
git add scripts/make-icons.mjs build/icon.ico resources/tray.ico electron.vite.config.ts src/main/tray.ts src/main/settings-window.ts src/main/app.ts src/renderer/settings.html src/renderer/settings
git commit -m "feat: add tray menu, settings window and Lucide gauge icons"
```

---
### Task 15: Threshold and reset notifications

**Files:**
- Create: `src/main/notifier.ts`
- Modify: `src/main/app.ts` (replace the `[task-15]` markers)

**Interfaces:**
- Consumes: `AlertEngine`, `AlertEvent` (Task 10); `alertText` (Task 10); `IslandWindow.expand()` (Task 12); `persist`, `onSnapshot`, `store`, `settings` inside `startApp` (Task 12).
- Produces: `function showAlert(text: { title: string; body: string }, onClick: () => void): void`.

- [ ] **Step 1: Create `src/main/notifier.ts`**

```ts
import { Notification } from 'electron';

// Keep references until the toast is dismissed; otherwise Electron may garbage-collect it and drop the click handler.
const live = new Set<Notification>();

export function showAlert(text: { title: string; body: string }, onClick: () => void): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title: text.title, body: text.body, silent: false });
  live.add(notification);
  notification.on('click', () => {
    onClick();
    live.delete(notification);
  });
  notification.on('close', () => live.delete(notification));
  notification.show();
}
```

- [ ] **Step 2: Wire alerts into `app.ts`**

Replace `// [task-15] alert imports` with:
```ts
import { AlertEngine } from './alert-engine';
import { alertText } from './alert-text';
import { showAlert } from './notifier';
```

Replace `  // [task-15] alert engine` with:
```ts
  const alerts = new AlertEngine(persisted.alertsFired);
```

In `persist`, replace:
```ts
      saveState(stateFile, { lastGood: store.lastGoodMap(), alertsFired: persisted.alertsFired });
```
with:
```ts
      saveState(stateFile, { lastGood: store.lastGoodMap(), alertsFired: alerts.firedKeys() });
```

In `onSnapshot`, replace:
```ts
    void previous; // [task-15] evaluate alerts against previous?.lastGood
```
with:
```ts
    if (settings.alertsEnabled) {
      const now = Date.now();
      alerts.prune(now);
      const events = alerts.evaluate({
        previous: previous?.lastGood,
        next: snapshot,
        warnPercent: settings.warnPercent,
        criticalPercent: settings.criticalPercent,
        now,
      });
      for (const event of events) {
        const providerName = plugins.find((plugin) => plugin.id === event.providerId)?.name ?? event.providerId;
        showAlert(alertText(event, providerName, now), () => island.expand());
      }
    }
```

- [ ] **Step 3: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Check notifications on Windows**

To force a threshold without waiting for real usage, temporarily set a low threshold. Open Settings, set **Warning at** to `1` and **Critical at** to `2`, then click the panel's refresh button.
Expected:
- A Windows notification appears for each provider, e.g. "Claude · 5-hour limit at 73%" / "Passed 2% · Resets in …".
- Clicking it expands the island.
- Clicking refresh again shows no repeat notification.
- Quitting and restarting the app (`npm run dev` again) shows no repeat either, because the keys persist in `state.json`.

Restore **Warning at** `80` and **Critical at** `95`.

In dev, notifications may appear under "electron.app.Electron" instead of "AI Usage". The installed build from Task 17 uses the AI Usage name, because the installer's shortcut carries `APP_ID`.

- [ ] **Step 5: Commit**

```bash
git add src/main/notifier.ts src/main/app.ts
git commit -m "feat: show Windows notifications for thresholds and resets"
```

---

### Task 16: Hide in fullscreen, multi-monitor and start with Windows

**Files:**
- Create: `src/main/foreground-window.ts`
- Modify: `src/main/app.ts` (replace the `[task-16]` markers)

**Interfaces:**
- Consumes: `FullscreenWatch`, `ForegroundWindow` (Task 11); `IslandWindow.setFullscreenHidden` (Task 12); `islandDisplay`, `settings`, `applySettings` inside `startApp` (Task 12).
- Produces: `function createForegroundReader(): (() => ForegroundWindow | null) | null` (null off Windows).

- [ ] **Step 1: Create `src/main/foreground-window.ts`**

```ts
import koffi from 'koffi';
import type { ForegroundWindow } from './fullscreen';

/** Returns a reader for the current foreground window, or null when not on Windows. */
export function createForegroundReader(): (() => ForegroundWindow | null) | null {
  if (process.platform !== 'win32') return null;

  const user32 = koffi.load('user32.dll');
  // Named types are referenced by name in the prototypes below.
  koffi.pointer('HWND', koffi.opaque());
  koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });

  const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()');
  const GetWindowRect = user32.func('bool __stdcall GetWindowRect(HWND hWnd, _Out_ RECT *lpRect)');
  const GetClassNameW = user32.func('int __stdcall GetClassNameW(HWND hWnd, _Out_ uint16_t *lpClassName, int nMaxCount)');

  return () => {
    const hwnd = GetForegroundWindow();
    if (!hwnd) return null;
    const rect = { left: 0, top: 0, right: 0, bottom: 0 };
    if (!GetWindowRect(hwnd, rect)) return null;
    const buffer = Buffer.alloc(512);
    const length = GetClassNameW(hwnd, buffer, 256) as number;
    return { rect, className: buffer.toString('utf16le', 0, length * 2) };
  };
}
```

- [ ] **Step 2: Wire the fullscreen watch and login item into `app.ts`**

Replace `// [task-16] fullscreen imports` with:
```ts
import { createForegroundReader } from './foreground-window';
import { FullscreenWatch } from './fullscreen';
```

Replace `  // [task-16] fullscreen watch + login item` with:
```ts
  const readForeground = (() => {
    try {
      return createForegroundReader();
    } catch (error) {
      log.warn('fullscreen detection unavailable', error);
      return null;
    }
  })();
  // GetWindowRect reports physical pixels, so compare against the display in physical pixels too.
  const fullscreenWatch = readForeground
    ? new FullscreenWatch(readForeground, () => screen.dipToScreenRect(null, islandDisplay().bounds), (hidden) =>
        island.setFullscreenHidden(hidden),
      )
    : null;
  applyPlatformSettings();
```

Directly above `function applySettings(next: Settings): Settings {`, add:
```ts
  function applyPlatformSettings(): void {
    if (settings.hideInFullscreen) fullscreenWatch?.start();
    else fullscreenWatch?.stop();
    // In dev the login item would point at electron.exe, so only the installed app registers itself.
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  }
```
`fullscreenWatch` is declared further down but only read when `applyPlatformSettings` runs. The first call comes after its declaration, and later calls come from IPC or tray, so this is safe. TypeScript accepts it because the use is inside a function body.

In `applySettings`, replace:
```ts
    // [task-16] apply login item + fullscreen watch
```
with:
```ts
    applyPlatformSettings();
```

- [ ] **Step 3: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Check on Windows**

Run: `scripts/sync-to-windows.sh`, then `npm run dev`.
Expected:
1. Open a YouTube video in the browser and press `F`, or press F11 on the browser. The island disappears within about 2 s, and comes back when you leave fullscreen.
2. A normal maximized window (taskbar visible) does **not** hide the island.
3. Turning off "Hide when a fullscreen app is in front" in Settings keeps the island visible over fullscreen video.
4. With a second monitor: choose it in Settings → Display and the island moves there. Unplug that monitor and the island moves to the primary display.
5. Change Windows display scaling (Settings → Display → Scale) and the island stays top-center.

- [ ] **Step 5: Commit**

```bash
git add src/main/foreground-window.ts src/main/app.ts
git commit -m "feat: hide island over fullscreen apps and register login item"
```

---

### Task 17: Windows installer and manual acceptance pass

**Files:**
- Create: `electron-builder.yml`
- Create: `docs/manual-test-checklist.md`

**Interfaces:**
- Consumes: `build/icon.ico` (Task 14); `APP_ID` and `PRODUCT_NAME` values (Task 1); the complete app (Tasks 12–16).
- Produces: `dist\AI Usage Setup 0.1.0.exe` (built on Windows).

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: com.rpbaguio.ai-usage
productName: AI Usage
directories:
  buildResources: build
  output: dist
files:
  - out/**
  - resources/**
  - package.json
asarUnpack:
  - resources/**
win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.ico
nsis:
  oneClick: true
  perMachine: false
  createDesktopShortcut: false
  createStartMenuShortcut: true
  shortcutName: AI Usage
  runAfterFinish: true
```

- [ ] **Step 2: Create `docs/manual-test-checklist.md`**

```markdown
# Manual test checklist (Windows)

Run against the installed build (`dist\AI Usage Setup <version>.exe`). Tick each item.

## Install
- [ ] Installer runs without admin rights (SmartScreen "More info → Run anyway" is expected: unsigned).
- [ ] App starts after install; Start Menu has "AI Usage".

## Island
- [ ] Pill sits top-center of the primary display, above other windows, no taskbar button.
- [ ] Clicks elsewhere on the screen are not blocked by the island.
- [ ] Click pill → panel expands; click pill → collapses.
- [ ] Expanded, press Esc → collapses; click another app → collapses.
- [ ] Hovering does not expand.
- [ ] Claude shows "Max (5x)" (or your plan), 5-hour and weekly rows, reset text, bars.
- [ ] Codex shows plan and weekly/5-hour rows, footer "Codex from logs, … old".
- [ ] arrow-up-right opens the provider usage page.

## Sources
- [ ] Settings lists Windows and WSL sources for each provider that exists there.
- [ ] Choosing a specific source updates the panel header's source label.
- [ ] With the Claude token expired (sign out of Claude Code in that source), status line reads "Login expired · run claude to refresh" and values dim.
- [ ] Disconnect network → "Couldn't reach Anthropic · retrying in 1 min".

## Alerts
- [ ] Lowering thresholds produces one notification per limit; no repeat on refresh or restart.
- [ ] Notification click expands the island.
- [ ] Notifications are attributed to "AI Usage".

## Platform
- [ ] Fullscreen video/game hides the island; leaving fullscreen shows it.
- [ ] Maximized (non-fullscreen) window does not hide it.
- [ ] Second monitor selection moves the island; unplugging falls back to primary.
- [ ] Sleep → wake refreshes within a few seconds.
- [ ] "Start with Windows" on → sign out/in (or reboot) → app starts; off → does not start.
- [ ] Tray: Hide/Show island, Refresh now, Settings…, Quit all work.

## Safety
- [ ] `%APPDATA%\ai-usage\logs\main.log`, `settings.json`, `state.json` contain no `Bearer`, `sk-ant`, `accessToken`, `refresh`.

## Uninstall
- [ ] Apps & features → AI Usage → Uninstall removes the app and its Start Menu entry.
```

- [ ] **Step 3: Build the installer on Windows**

Run `scripts/sync-to-windows.sh`, then in PowerShell: `cd C:\dev\ai-usage; npm install; npm run dist`
Expected: `dist\AI Usage Setup 0.1.0.exe` is created. (`electron-builder` finds the native `koffi` binaries and unpacks them automatically.)

- [ ] **Step 4: Install and run the checklist**

Run `dist\AI Usage Setup 0.1.0.exe`, then go through `docs/manual-test-checklist.md` and tick every item. For any failure, stop and fix it in a follow-up commit before continuing. Record the failure and the fix in the commit message.

- [ ] **Step 5: Check the data files for secrets**

In PowerShell:
```powershell
Select-String -Path "$env:APPDATA\ai-usage\logs\main.log","$env:APPDATA\ai-usage\settings.json","$env:APPDATA\ai-usage\state.json" -Pattern 'Bearer ','sk-ant','accessToken','refreshToken'
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add electron-builder.yml docs/manual-test-checklist.md
git commit -m "build: add NSIS installer config and manual acceptance checklist"
```
