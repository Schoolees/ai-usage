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
