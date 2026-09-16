import { spawn } from 'node:child_process';
import type { Source } from '../shared/types';
import type { initLog } from './log';
import { distroFromHome } from './sources/detect';

export interface TerminalCommand {
  file: string;
  args: string[];
}

/**
 * How each CLI signs in. `logout` is deliberately not chained in front: `claude auth logout` clears
 * the credentials file, which also holds the OAuth tokens for every MCP server the user has
 * connected, and abandoning the browser flow afterwards would leave them signed out of everything.
 * Signing in over an existing session is the CLI's own job.
 */
const LOGIN_COMMAND: Record<string, string> = {
  claude: 'claude auth login',
  codex: 'codex login',
};

/** Whether this provider has a CLI sign-in at all, so the UI can leave out the ones that do not. */
export function hasLoginCommand(providerId: string): boolean {
  return providerId in LOGIN_COMMAND;
}

/** Leaves the console up after the CLI exits, so a failure can still be read. */
const PAUSE = "echo; read -rp 'Press Enter to close…'";

/**
 * The command that opens a console on `source` and runs that provider's sign-in. Null when the
 * provider has no sign-in command, or a WSL home does not name a distro.
 */
export function loginCommand(providerId: string, source: Source): TerminalCommand | null {
  const cli = LOGIN_COMMAND[providerId];
  if (!cli) return null;

  if (source.kind === 'wsl') {
    const distro = distroFromHome(source.home);
    if (!distro) return null;
    // A login shell, so the CLI is on PATH exactly as it is when the user runs it by hand.
    return { file: 'wsl.exe', args: ['-d', distro, '--', 'bash', '-lc', `${cli}; ${PAUSE}`] };
  }
  // cmd's /k leaves the window open once the CLI exits.
  return { file: 'cmd.exe', args: ['/k', cli] };
}

/**
 * Opens a console running the provider's sign-in, so the user completes the flow themselves. The app
 * never reads or writes a credential; it only starts the CLI. Returns false when there is nothing to
 * run, so the caller can say so instead of looking like it worked.
 */
export function startLogin(providerId: string, source: Source, log: ReturnType<typeof initLog>): boolean {
  const command = loginCommand(providerId, source);
  if (!command) {
    log.warn(`switch account: nothing to run for ${providerId} on ${source.label}`);
    return false;
  }
  log.info(`switch account: ${providerId} on ${source.label}`);
  // `detached` gives the console its own window; without one the sign-in URL would never be seen.
  const child = spawn(command.file, command.args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', (error) => log.warn('switch account: could not start the CLI', error));
  child.unref();
  return true;
}
