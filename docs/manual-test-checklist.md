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
