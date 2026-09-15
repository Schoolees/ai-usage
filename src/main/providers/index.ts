import { createClaudePlugin } from './claude/plugin';
import { createCodexPlugin } from './codex/plugin';
import type { ProviderPlugin } from './types';

/** Add new providers here. Order = order in the pill and panel. */
export function createProviders(): ProviderPlugin[] {
  return [createClaudePlugin(), createCodexPlugin()];
}
