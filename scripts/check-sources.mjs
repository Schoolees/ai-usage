// Bundles and runs scripts/check-sources.ts (the app's modules are TypeScript with extensionless imports).
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'ai-usage-check-'));
const outfile = join(dir, 'check-sources.mjs');
try {
  await build({
    entryPoints: ['scripts/check-sources.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['electron'],
    logLevel: 'warning',
  });
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
