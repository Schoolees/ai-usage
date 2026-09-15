# AI Usage

A notch-style island for Windows that shows your **Claude** and **ChatGPT/Codex** plan usage limits: the 5-hour and weekly windows, at the top of your screen. Hover the pill to see every limit, when it resets, and how close you are.

It reads the logins and logs that the Claude Code and Codex CLIs already keep on your machine, in the Windows home folder and in running WSL distros. It follows your Windows theme and accent color, and alerts you before you hit a limit.

> Status: early (v0.1). Windows 10/11 only.

## Features

- **Island at the top of the screen.** A small always-on-top pill shows each provider's 5-hour usage and plan (`MAX`, `PRO`, `PLUS`). Hover to expand a panel with every limit, a progress bar, and reset time ("Resets in 2 hr 8 min", "Resets Mon 1:00 PM").
- **Claude and Codex.** Claude's 5-hour, weekly, and per-model weekly limits; Codex's 5-hour and weekly limits.
- **Windows and WSL.** Finds CLI logins and logs in `%USERPROFILE%` and in every *running* WSL distro. It never starts a stopped distro. You can pick the source in Settings.
- **Alerts.** A Windows notification when a limit crosses your warning (default 80%) or critical (default 95%) threshold, and when a busy window resets. Each alert fires once per window.
- **Follows Windows personalization.** Dark/light mode, accent color, and Transparency effects (Mica backdrop on the settings window), updated live.
- **Stays out of the way.** Clicks pass through everywhere except the pill and open panel. It hides automatically over fullscreen apps, can live on any display, and starts with Windows.
- **Tray menu.** Show/hide the island, refresh now, settings, start with Windows, quit.

## How it gets the numbers

| Provider | Source | Refresh |
|---|---|---|
| Claude | Access token from Claude Code's login (`<home>/.claude/.credentials.json`), used to call the same usage endpoint Claude Code's `/usage` uses | Every 2 minutes (configurable, minimum 1) |
| ChatGPT / Codex | `rate_limits` records in Codex CLI session logs (`<home>/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`) | Checked every 30 seconds; the numbers only change when Codex writes a new log |

Neither usage source is a documented public API. They can change without notice, and the app shows an error or "stale" state rather than a wrong number when they do.

### Privacy and credentials

- Tokens are read only by the Electron main process. They never reach the UI, logs, or any file the app writes.
- The Claude token is sent only to Anthropic's API. Nothing is sent anywhere else, and there is no telemetry.
- The app **never refreshes or rewrites** CLI tokens, so it can't sign your CLI out. When a token expires, the island shows "Login expired · run claude to refresh" until Claude Code refreshes it.
- Log output passes through a redaction filter that removes bearer tokens, API keys, and JWTs.

App data lives in `%APPDATA%\ai-usage\` (`settings.json`, `state.json`, `logs\main.log`).

## Install

Build the installer (see below), then run `dist\AI Usage Setup <version>.exe`. It installs per user with no admin rights.

The installer is unsigned, so Windows SmartScreen will warn on first run. Choose **More info → Run anyway**.

You need at least one of:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) signed in with a Claude Pro/Max plan
- [Codex CLI](https://github.com/openai/codex) signed in with a ChatGPT plan, and used at least once, so logs exist

## Development

Requirements: Node.js **22.12+** (the build tools don't run on older Node), npm, Windows 10/11 to run the app.

```bash
npm install
npm run dev          # run the app with hot reload (on Windows)
npm test             # unit and component tests (vitest)
npm run typecheck    # tsc for main/preload and renderer
npm run build        # bundle to out/
npm run dist         # build the Windows NSIS installer into dist/
npm run icons        # regenerate build/icon.ico and resources/tray.ico
```

### Working from WSL

The code and tests run fine in WSL, but the app itself (always-on-top window, tray, notifications, fullscreen detection) must run on Windows. `scripts/sync-to-windows.sh` copies the repo to `C:\dev\ai-usage`, excluding `node_modules`, `out` and `dist`, so Windows keeps its own native modules:

```bash
scripts/sync-to-windows.sh
```

Then in PowerShell:

```powershell
cd C:\dev\ai-usage
npm install
npm run dev
```

If `node -v` on Windows prints a version below 22.12, call a newer Node explicitly, for example `& "C:\Program Files\nodejs\npm.cmd" run dist`.

## Project layout

```
src/
  main/            Electron main process
    providers/     provider plugins (claude/, codex/) behind a common interface
    sources/       Windows home + running WSL distro detection
    app.ts         composition root: scheduler, store, alerts, IPC, tray, windows
    island-window.ts, settings-window.ts, tray.ts, notifier.ts
    scheduler.ts, usage-store.ts, alert-engine.ts, system-theme.ts, redact.ts
  preload/         typed contextBridge API (window.api)
  renderer/
    island/        pill + panel (React)
    settings/      settings window (React)
    palette.css    shared color palette; theme.ts applies the Windows theme
  shared/          types, settings schema (zod), view model, formatting, IPC contract
docs/
  superpowers/specs/   design spec
  superpowers/plans/   implementation plan
  manual-test-checklist.md
```

Pure logic (parsers, scheduler, alerts, view model, theme) has no Electron imports and is unit-tested. Electron wiring is covered by the manual checklist.

## Adding a provider

1. Create `src/main/providers/<id>/` with a `plugin.ts` implementing `ProviderPlugin` (`src/main/providers/types.ts`): `detectSources`, `fetch`, interval, and staleness.
2. Put parsing in its own module with fixture-based tests. `fetch` must return a non-ok status instead of throwing for expected failures.
3. Register it in `src/main/providers/index.ts`.

A provider is worth adding only if it has a readable source of real rolling-window limits (not just spend).

## Known limitations

- Windows only. No macOS or Linux build.
- The usage endpoints are undocumented and may change.
- Codex numbers come from local logs. They update only when you use the Codex CLI on this machine, and usage from elsewhere isn't counted.
- The island is translucent but can't blur the desktop behind it (it has to stay a transparent click-through window).
- The installer is unsigned and there is no auto-update.

## Testing

`npm test` runs the automated suite. Before a release, go through [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) on a real Windows desktop: hover behavior, click-through, fullscreen hiding, multi-monitor, notifications, start with Windows, and theme changes.

## License

[MIT](LICENSE) © 2026 Schoolees
