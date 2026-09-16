// Regenerates docs/screenshots/*.png from the real renderer components, with sample data.
//
// It bundles scripts/screenshots/{island,settings}.tsx with esbuild and shoots the pages with a
// headless Chromium. Set CHROME to point at a browser binary; otherwise Playwright's cached
// chrome-headless-shell, `chromium` or `google-chrome` is used.
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { glob } from 'node:fs/promises';

const run = promisify(execFile);
const OUT = 'docs/screenshots';

/** window-size is CSS pixels; every shot is taken at 2x so the README stays sharp on a HiDPI screen. */
const SHOTS = [
  { name: 'island', page: 'island.html', width: 560, height: 90 },
  { name: 'panel', page: 'island.html?expanded', width: 560, height: 400 },
  { name: 'settings', page: 'settings.html', width: 900, height: 660 },
];

async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache/ms-playwright');
  if (existsSync(cache)) {
    for await (const hit of glob('chromium*/**/chrome-headless-shell', { cwd: cache })) return join(cache, hit);
    for await (const hit of glob('chromium*/**/chrome', { cwd: cache })) return join(cache, hit);
  }
  for (const name of ['chromium', 'chromium-browser', 'google-chrome']) {
    try {
      const { stdout } = await run('which', [name]);
      return stdout.trim();
    } catch {
      // try the next one
    }
  }
  throw new Error('No Chromium found. Install one, or set CHROME to a browser binary.');
}

const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const chrome = await findChrome();
const dir = await mkdtemp(join(tmpdir(), 'ai-usage-shots-'));

try {
  for (const entry of ['island', 'settings']) {
    await build({
      entryPoints: [`scripts/screenshots/${entry}.tsx`],
      outfile: join(dir, `${entry}.js`),
      bundle: true,
      jsx: 'automatic',
      loader: { '.css': 'css' },
      define: { 'process.env.NODE_ENV': '"production"', VERSION: JSON.stringify(version) },
      logLevel: 'warning',
    });
    await copyFile(`scripts/screenshots/${entry}.html`, join(dir, `${entry}.html`));
  }

  await mkdir(OUT, { recursive: true });
  for (const { name, page, width, height } of SHOTS) {
    const out = join(OUT, `${name}.png`);
    await run(chrome, [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=2',
      `--window-size=${width},${height}`,
      '--virtual-time-budget=4000',
      `--screenshot=${out}`,
      `file://${join(dir, basename(page))}${page.includes('?') ? `?${page.split('?')[1]}` : ''}`,
    ], { env: { ...process.env, TZ: 'UTC' } });
    console.log(`${out}  ${width * 2}×${height * 2}`);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
