// Signing rewrites the installer, so the sha512 and size electron-builder recorded before signing no
// longer describe the file we ship. electron-updater checks both and refuses an update whose hash
// does not match, so latest.yml and the .blockmap have to be rebuilt from the signed installer.
//
//   node scripts/update-signed-metadata.mjs [dist-dir]
import { buildBlockMap } from 'app-builder-lib/out/targets/blockmap/blockmap.js';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

/**
 * Point every sha512/size in a parsed latest.yml at the files as they are now. `measured` maps a
 * file's url to its current hash and size. Returns a new document; the input is left alone.
 */
export function updateLatestYml(doc, measured) {
  const files = (doc.files ?? []).map((entry) => {
    const now = measured.get(entry.url);
    if (!now) throw new Error(`latest.yml lists ${entry.url}, which was not measured`);
    return { ...entry, sha512: now.sha512, size: now.size };
  });
  const primary = files.find((entry) => entry.url === doc.path) ?? files[0];
  if (!primary) throw new Error('latest.yml lists no files');
  // `sha512` at the top level is what electron-updater 2.x and older read; keep it in step.
  return { ...doc, files, sha512: primary.sha512 };
}

async function main() {
  const dist = process.argv[2] ?? 'dist';
  const ymlPath = join(dist, 'latest.yml');
  const doc = yaml.load(await readFile(ymlPath, 'utf8'));

  const measured = new Map();
  for (const entry of doc.files ?? []) {
    const file = join(dist, entry.url);
    // Rebuilding the block map also gives us the hash of the file as it now stands.
    const { sha512 } = await buildBlockMap(file, 'gzip', `${file}.blockmap`);
    const { size } = await stat(file);
    measured.set(entry.url, { sha512, size });
    console.log(`${entry.url}  ${size} bytes  ${sha512.slice(0, 16)}…`);
  }

  await writeFile(ymlPath, yaml.dump(updateLatestYml(doc, measured), { lineWidth: -1 }));
  console.log(`${ymlPath} updated`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
