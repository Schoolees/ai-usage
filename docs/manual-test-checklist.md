# Manual test checklist (Windows)

Run against the installed build (`dist\AI Usage Setup <version>.exe`). Tick each item.

## Install
- [ ] Installer runs without admin rights (SmartScreen "More info → Run anyway" is expected: unsigned).
- [ ] App starts after install; Start Menu has "AI Usage".

## Island
- [ ] Pill sits top-center of the primary display, above other windows, no taskbar button.
- [ ] Clicks elsewhere on the screen are not blocked by the island.
- [ ] Hover the pill → panel springs open smoothly (no jump, flicker or clipped panel).
- [ ] Move from pill into panel → stays open; move away → closes smoothly; a fast flick off the top edge also closes it.
- [ ] Brushing past the pill quickly does not open it; clicking the pill does nothing.
- [ ] While collapsed and while open, clicks beside/below the pill reach the app behind it.
- [ ] Refresh button icon spins while refreshing.
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

## Switch account
- [ ] The sign-in icon beside each provider opens a console window titled with `wsl.exe` (WSL source) or `cmd` (Windows source).
- [ ] The console runs `claude auth login` / `codex login` and shows the sign-in URL; the browser flow completes.
- [ ] Within a minute of finishing, the island shows the new account's plan and usage.
- [ ] Signing in to a different account works without logging out first. If a CLI refuses because a session exists, note it: the app would then need to run `logout` first.
- [ ] Closing the console without signing in leaves the previous account signed in, and MCP server logins intact.
- [ ] Tray → **Switch account** lists only providers with a detected source, and is disabled when there are none — including straight after launch, once detection finishes.

## Updates
Install an older version, then publish/point at a newer one.
- [ ] Tray shows "Downloading update X…", then "Restart to update to X"; clicking it restarts into the new version.
- [ ] Quitting from the tray with an update ready installs it and the app comes back by itself, at the new version.
- [ ] After that update the Start Menu entry still exists — delete `%APPDATA%\Microsoft\Windows\Start Menu\Programs\AI Usage.lnk`, update again, and it is recreated.
- [ ] Apps & features lists exactly one "AI Usage" entry, at the installed version.
- [ ] Settings → Updates → off: the tray reads "Updates are turned off" and no check happens.

## Safety
- [ ] `%APPDATA%\ai-usage\logs\main.log`, `settings.json`, `state.json` contain no `Bearer`, `sk-ant`, `accessToken`, `refresh`.

## Uninstall
- [ ] Apps & features → AI Usage → Uninstall removes the app and its Start Menu entry.
