# AI Usage Island — Design

- **Date:** 2026-09-15
- **Status:** Approved in brainstorming, pending written-spec review
- **Project:** `~/ai-usage` (new)

## 1. Goal

A Windows desktop app, built with Electron, that shows AI **subscription plan usage limits** in a notch-style island at the top of the screen. It's modeled on Claude's "Plan usage limits" panel: each limit shows a label, a reset time, a percentage and a progress bar. Providers plug in behind a common interface, so it isn't tied to one vendor.

### In scope (v1)

- Subscription rolling-window limits for **Claude** (Claude Code login) and **ChatGPT via Codex** (Codex CLI login and logs).
- Credentials and logs from **both** the Windows home folder and running **WSL** distros.
- A top-center island that expands **on hover** (changed from click-only on 2026-09-15 at the user's request).
- Threshold alerts, start with Windows, hide in fullscreen, and a choice of display.

### Out of scope (v1)

- API-key balance or spend tracking (OpenAI API, DeepSeek, OpenRouter, Anthropic Console). DeepSeek has no subscription windows, so it's excluded.
- The "Context window" (per-session context fill) row.
- The app's own OAuth sign-in. The app reuses CLI credentials read-only.
- Code signing, auto-update, macOS and Linux builds.

## 2. Data sources

Both usage calls are **undocumented** and may change. Build step 0 is a spike that confirms them and captures sample responses before anything depends on them.

| Provider | Credentials / data | Live source | Notes |
|---|---|---|---|
| Claude | `<home>/.claude/.credentials.json` → `claudeAiOauth.{accessToken, expiresAt, subscriptionType, rateLimitTier}` | Usage call made by Claude Code's `/usage`, authenticated with the OAuth access token (exact URL and headers confirmed in the spike) | No local file stores the percentages, so polling is required |
| Codex | `<home>/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` → `event_msg` / `token_count` records with `payload.rate_limits.{primary, secondary, plan_type}` | Optional: ChatGPT usage call using `<home>/.codex/auth.json`, **only if the spike confirms it** | Log data only updates while Codex is in use |

A Codex `rate_limits` record, as observed on this machine:

```json
{"limit_id":"codex","primary":{"used_percent":9.0,"window_minutes":10080,"resets_at":1785903101},
 "secondary":null,"plan_type":"prolite","credits":{"has_credits":false,"unlimited":false,"balance":"0"}}
```

### Token safety rules (hard requirements)

- Only the Electron **main process** reads tokens.
- Tokens never go to the renderer, logs, `state.json` or any file.
- Tokens are sent only to their own provider's server.
- The app **never refreshes or rewrites tokens**, because rotating a refresh token could sign the CLI out. An expired token means `auth-expired` status.

### Spike findings (2026-09-15)

- Claude usage URL: `https://api.anthropic.com/api/oauth/usage`; headers: `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20`. Returned HTTP 200 on the first try; no fallback URL search was needed.
- `utilization` unit: percent 0–100 (observed `63.0`, `39.0`, `0.0`), matching the assumed shape. `resets_at` format: ISO 8601 string with microseconds and UTC offset (e.g. `2026-09-15T08:50:00.926998+00:00`), matching the assumed shape.
- Window keys observed (top-level object with both `utilization` and `resets_at`): `five_hour`, `seven_day`, `nimbus_quill` (an inactive/experimental window: `utilization: 0.0`, `resets_at: null`). `seven_day_opus` is present but `null`, as assumed.
- Differences from the assumed shape: the real response has many more top-level keys than the four in the brief's example. Most are `null` placeholders for internal/experimental limit types with obfuscated codenames (`seven_day_oauth_apps`, `seven_day_sonnet`, `seven_day_cowork`, `seven_day_omelette`, `tangelo`, `iguana_necktie`, `omelette_promotional`, `cinder_cove`, `copper_kite`, `harbor_lantern`, `amber_ladder`, `juniper_tide`, `cedar_ember`) — a parser should ignore unknown top-level keys rather than assume a fixed key set. There are also three additional structured top-level keys not in the assumed shape: `limits` (an array of `{kind, group, percent, severity, resets_at, scope, is_active}` records — a normalized alternate view of the same session/weekly windows, including a model-scoped weekly entry), `spend` (usage-credit spend/balance info, all `null`/disabled on this account), and `seven_day_breakdown` (a per-surface percent breakdown, e.g. `claude_code`, `chat`, `cowork`, `other`). `extra_usage` matches the assumed shape (`{is_enabled: false, ...}`) but has more fields than just `is_enabled`. Task 4's parser should read `five_hour` and `seven_day` (and optionally `seven_day_opus`) by name and not assume those are the only top-level keys.
- ChatGPT live usage call: none found; Codex stays log-based. (`codex` CLI is not installed on this machine, so the search was skipped per the optional-step ruling.)
- Fixture: `src/main/providers/claude/fixtures/usage.json`.

## 3. The island and its windows

### Island window

- One borderless, transparent, always-on-top window with no taskbar entry, placed top-center on the chosen display's work area.
- **Window size:** fixed to fit pill + panel, so hovering never resizes it (resizing a transparent window mid-animation caused visible jumps). Everything outside the pill and the open panel is click-through (`setIgnoreMouseEvents(true, { forward: true })`), so the rest of the screen stays clickable.
- **Expand:** resting the pointer on the pill for 90 ms expands it. The pill grows and the panel springs down with CSS transitions (transform/opacity only).
- **Collapse:** 280 ms after the pointer leaves the pill and panel (enough time to cross between them), or at once when the main process sees the cursor outside the window. An expand requested by a notification click closes after 5 s if the pointer never arrives. The window never takes focus.

### Pill

- One segment per enabled provider: a provider color dot, the name and the **highest** current `usedPercent`.
- ≥ warning threshold (default 80%): amber, with the Lucide `triangle-alert` icon.
- ≥ critical threshold (default 95%): red, with `triangle-alert`.
- Stale: dimmed, with `clock-alert`.
- No data: dimmed, with `cloud-off` and no percentage.

### Panel

- One group per provider. The header shows the plan and source, e.g. `Claude · Max (5x) · [square-terminal] WSL` or `[monitor] Windows`, plus an `arrow-up-right` link that opens the provider's usage page.
- **Limit row:** a bold label, the reset time and a percentage, over a progress bar that follows the threshold colors.
  - Reset time under 24 h: relative ("Resets in 2 hr 8 min").
  - Otherwise: day and time ("Resets Mon 1:00 PM").
  - Reset time already passed: "Reset since last seen", with no percentage.
- **Status line:** replaces or annotates rows for the non-ok statuses (see §5).
- **Footer:** `clock` "Updated 1 min ago", plus the log age for log-based providers, and the `refresh-cw` and `settings` buttons.

### Icons

- All UI icons come from **`lucide-react`**: 2 px stroke, `currentColor`.
- Provider identity uses colored dots, because Lucide has no brand marks.
- The tray icon is Lucide `gauge`, rendered to `.ico` and PNG by `scripts/make-icons.ts`.

### Tray menu

Show/Hide island · Refresh now · Settings… · Start with Windows (checkbox) · Quit.

### Settings window (dark custom title bar, sidebar sections; styled after the Claude desktop app's settings)

- Enable or disable each provider, and pick its source (Windows or a detected WSL distro).
- Island display.
- Warning and critical thresholds.
- Claude refresh interval (default 2 min, minimum 1 min).
- Hide in fullscreen, and start with Windows.

### Platform features

- **Multi-monitor:** the island uses the display saved in settings (by display id). It falls back to the primary display if that one is missing, and repositions on `display-added`, `display-removed` and `display-metrics-changed`.
- **Hide in fullscreen:** every 1.5 s, `koffi` calls `user32` `GetForegroundWindow`, `GetWindowRect` and `MonitorFromWindow`. If the foreground window covers its whole monitor, and it isn't the desktop or shell (`Progman`, `WorkerW`), the island hides on that monitor. It shows again when that stops being true.
- **Start with Windows:** `app.setLoginItemSettings({ openAtLogin })`.
- **Single instance:** `app.requestSingleInstanceLock()`. A second launch shows the island of the copy that's already running.

## 4. Provider plugins

```ts
interface ProviderPlugin {
  id: string;                                   // 'claude', 'codex'
  name: string;                                 // 'Claude', 'ChatGPT (Codex)'
  detectSources(): Promise<Source[]>;
  fetch(source: Source): Promise<Snapshot>;
}
type Source   = { kind: 'windows' | 'wsl'; label: string; home: string };
type Snapshot = {
  plan?: string;
  status: 'ok' | 'stale' | 'auth-expired' | 'not-found' | 'error';
  dataAsOf: Date;
  limits: Limit[];
  message?: string;
  retryAfterMs?: number;
};
type Limit    = { id: string; label: string; usedPercent: number | null; resetsAt: Date | null };
```

### Source detection (`sources/detect.ts`)

- **Windows:** `os.homedir()`.
- **WSL:** list distros with `wsl.exe -l --running -q`, which outputs UTF-16LE. Only running distros are probed, because touching `\\wsl.localhost\<distro>` boots a stopped one.
  - In each running distro, scan `\\wsl.localhost\<distro>\home\*` for the provider's folder.
- A plugin offers every location where its files exist.
- **Default source:** the location whose credential or log file changed most recently. Settings can override it.

### Claude plugin

1. Read `.credentials.json`. If it's missing, return `not-found`.
2. If `expiresAt <= now`, return `auth-expired` without making the call. The store keeps the last good limits.
3. Call the usage endpoint.
   - HTTP 401/403 → `auth-expired`.
   - HTTP 429 → `error`, with `retryAfterMs` taken from `Retry-After`.
   - Network or 5xx errors → `error`.
4. Map the response keys:
   - `five_hour` → "5-hour limit"
   - `seven_day` → "Weekly · all models"
   - `seven_day_<model>` → "Weekly · <Model>"
   - Unknown window keys → a label built from the key.
5. Plan label from `subscriptionType` + `rateLimitTier`. For example, `max` + `default_claude_max_5x` → "Max (5x)". Unknown combinations → the capitalized `subscriptionType`.

### Codex plugin

1. Find the newest `rollout-*.jsonl` by modified time, scanning only the last 14 date folders. If there's none, return `not-found`.
2. Read the file from the end and find the last `token_count` record with `rate_limits`.
3. Build a limit from `primary` and one from `secondary`, labeled by `window_minutes`:
   - 300 → "5-hour limit"
   - 10080 → "Weekly limit"
   - 43200 → "30-day limit"
   - Otherwise, "N-day limit" or "N-hour limit".
4. Plan label from `plan_type`: `free`, `plus`, `pro`, `prolite` → "Free", "Plus", "Pro", "Pro Lite". Unknown values → capitalized.
5. `dataAsOf` is the record's timestamp. A limit whose `resets_at < now` gets `usedPercent: null`, shown as "Reset since last seen".

### Adding a provider

- Create `src/main/providers/<id>/` containing `plugin.ts`, `parse.ts`, `fixtures/` and tests.
- Register it in `providers/index.ts`.
- Requirement: a readable source of **real rolling-window** data. Candidates: Gemini CLI, GitHub Copilot.

## 5. Data flow, state, alerts, errors

```
Provider plugins ─fetch→ Scheduler ─snapshot→ UsageStore ─→ AlertEngine ─→ Windows notification
                                                  └─ view model over IPC ─→ island renderer
```

### Scheduler

- **Claude:** polls every `refreshIntervalMs`, default 120 000 ms.
- **Codex:** checks the sessions folder's modified time every 30 s and reads the log only when it changed. `fs.watch` isn't used because it's unreliable on UNC/WSL paths.
- **Immediate refresh:** at startup, on panel open when the data is older than 30 s, on the refresh button, and on `powerMonitor` `resume`.
- **Retry delays after errors:** 1 → 2 → 5 → 10 min (maximum). `retryAfterMs` takes priority when it's longer.

### UsageStore

- Holds each provider's `{ latest: Snapshot, lastGood?: Snapshot }`.
- Saves `lastGood` (never tokens) and the alert records to `userData/state.json`, so the panel has numbers immediately at launch.

### Stale rules

- **Claude:** `auth-expired`, or the last successful fetch was more than 10 min ago.
- **Codex:** `dataAsOf` is more than 24 h old.

### IPC

- `contextIsolation: true` and `sandbox: true`.
- The preload script exposes a typed API.
- **Main → renderer:** `usage:update` (the view model).
- **Renderer → main:** `usage:refresh`, `island:setExpanded`, `settings:get`, `settings:set`.
- Relative reset text is recalculated in the renderer every 30 s, with no fetch.

### AlertEngine

- **Threshold alert:** fires when a limit goes from below a threshold to at or above it. Records are keyed by `providerId + limitId + resetsAt + threshold`, so it fires at most once per threshold per reset period.
- **Reset alert:** fires once when a limit whose last known `usedPercent` was ≥ the warning threshold resets.
- Clicking a notification expands the island.
- The app calls `app.setAppUserModelId` to match the installer's shortcut.
- Records are saved to `state.json` so a restart doesn't repeat alerts. Records for reset periods that have ended are pruned.

### Status presentation

| Status | Panel |
|---|---|
| `not-found` | "No Claude Code login found in WSL · Ubuntu", plus a link to Settings |
| `auth-expired` | "Login expired: run `claude` to refresh" (or `codex`), with the last values dimmed |
| `error` | "Couldn't reach Anthropic · retrying in 2 min" |
| `stale` | Rows shown dimmed, with the age in the footer |

### App-level

- Settings are stored in `userData/settings.json` and validated with the `zod` schema in `src/shared`. An invalid or corrupt file falls back to defaults, and the broken file is kept as `settings.json.bak`.
- Logs are written with `electron-log` to `userData/logs/`. Values that look like tokens (`Bearer …`, `sk-…`, JWT-shaped strings, known credential field names) are blanked out before writing.

## 6. Project layout

```
ai-usage/
├─ electron.vite.config.ts · electron-builder.yml · vitest.config.ts · package.json
├─ scripts/
│  ├─ make-icons.ts
│  └─ sync-to-windows.sh
└─ src/
   ├─ shared/        view-model types, IPC channel names, settings schema
   ├─ preload/index.ts
   ├─ main/
   │  ├─ index.ts · island-window.ts · tray.ts · settings-window.ts · ipc.ts · log.ts
   │  ├─ fullscreen-watch.ts · scheduler.ts · usage-store.ts · alert-engine.ts
   │  ├─ settings.ts · state-file.ts
   │  ├─ sources/detect.ts
   │  └─ providers/{types.ts, index.ts, claude/, codex/}
   └─ renderer/
      ├─ island/    Pill.tsx · Panel.tsx · LimitRow.tsx · StatusLine.tsx · format.ts
      └─ settings/  SettingsApp.tsx
```

**Stack:** Electron, TypeScript, `electron-vite`, React, `lucide-react`, `zod`, `koffi`, `electron-log`, `vitest`, `@testing-library/react`, `electron-builder`.

## 7. Testing

1. **Unit tests** (`vitest`, run in WSL):
   - Claude and Codex parsers against captured fixtures, with tokens and IDs scrubbed.
   - Plan labels and `window_minutes` labels.
   - The "Reset since last seen" rule.
   - `AlertEngine` crossings, deduplication, reset alerts and pruning.
   - Scheduler retry delays and `retryAfterMs`, using fake timers.
   - `format.ts` relative and absolute reset text.
   - Settings defaults when the file is corrupt.
   - Source detection, with `fs` and `wsl.exe` output mocked, including UTF-16LE output.
   - Log redaction.
2. **Component tests:** `Pill` and `Panel` in the `ok`, warning, critical, `stale`, `auth-expired`, `not-found` and `error` states.
3. **Manual Windows checklist:**
   - Stays above other apps.
   - Click expand; collapse by clicking again, losing focus and Esc.
   - Switching displays, and unplugging the chosen display.
   - Hiding in fullscreen (F11 browser video, a fullscreen game).
   - Notifications appear, and clicking one expands the island.
   - Starting with Windows after a reboot.
   - Refreshing after sleep and resume.
   - NSIS install and uninstall.

## 8. Dev loop and packaging

- **Source of truth:** the git repo in WSL at `~/ai-usage`. Unit and component tests run there.
- **Running the real app:** `scripts/sync-to-windows.sh` copies the repo to `/mnt/c/dev/ai-usage` with rsync, skipping `node_modules`, `out` and `dist`. Then, in PowerShell at `C:\dev\ai-usage`, run `npm install` (first time, or when dependencies change) and `npm run dev`. Windows Node v24.13 is present.
- **Packaging:** `electron-builder` makes an NSIS per-user installer with no admin rights. Its `appId` is also used for `setAppUserModelId`. The installer is unsigned, so SmartScreen will warn on first run.

## 9. Build order

0. **Spike:** confirm the Claude usage call (URL, headers, response shape) and whether a ChatGPT usage call exists. Capture scrubbed fixtures. Record the findings in this spec.
1. Scaffold `electron-vite` + React + TS + vitest, and add `sync-to-windows.sh`.
2. Shared types, the provider interface and the Codex parser with tests.
3. Claude plugin with tests.
4. Source detection with tests.
5. UsageStore, Scheduler, state file and IPC.
6. Island window with Pill, Panel, LimitRow and StatusLine.
7. Tray, settings window and settings persistence.
8. AlertEngine and notifications.
9. Fullscreen watch, multi-monitor, start with Windows.
10. Icons, the `electron-builder` NSIS installer and the manual checklist pass.

## 10. Risks

- **Undocumented usage calls** may change or be blocked. Mitigations: the spike first; parsers that tolerate unknown keys; a clear `error` status instead of wrong numbers.
- **Token expiry while the CLI is idle** leaves Claude stale until `claude` runs again. This is accepted, because refreshing tokens is ruled out.
- **Codex log data can be old.** It's always shown with its age, and limits whose reset time has passed are neutralized.
- **Probing WSL paths** could be slow when a distro is busy. Probes time out after 3 s, and only running distros are probed.
- **Fullscreen detection edge cases** (borderless-windowed games, multiple monitors with different DPI scaling) are covered by the manual checklist. The setting can be turned off.
