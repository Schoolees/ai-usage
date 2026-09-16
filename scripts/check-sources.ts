/**
 * Prints what every provider resolves to on this machine: each detected source, the file or login it
 * reads, how old that data is, and the limits parsed from it.
 *
 * Run it (`npm run check:sources`) before a release, or whenever the island shows something odd — it
 * catches provider format drift without waiting for a wrong number to be noticed on screen.
 */
import { DEFAULT_SETTINGS } from '../src/shared/settings-schema';
import { formatDuration } from '../src/shared/format';
import type { Source } from '../src/shared/types';
import { createProviders } from '../src/main/providers';
import { defaultDetectDeps, listCandidateHomes } from '../src/main/sources/detect';

const OK = '[32m';
const WARN = '[33m';
const BAD = '[31m';
const DIM = '[2m';
const OFF = '[0m';

function color(status: string): string {
  if (status === 'ok') return `${OK}ok${OFF}`;
  if (status === 'stale' || status === 'not-found') return `${WARN}${status}${OFF}`;
  return `${BAD}${status}${OFF}`;
}

async function main(): Promise<void> {
  const now = Date.now();
  const candidates: Source[] = await listCandidateHomes(defaultDetectDeps());
  console.log(`Candidate homes (${candidates.length}):`);
  for (const candidate of candidates) console.log(`  ${candidate.label} ${DIM}${candidate.home}${OFF}`);

  let problems = 0;
  for (const plugin of createProviders()) {
    console.log(`\n${plugin.name}`);
    const detected = await plugin.detectSources(candidates);
    if (detected.length === 0) {
      console.log(`  ${WARN}no source found${OFF} — ${plugin.notFoundMessage}`);
      problems++;
      continue;
    }

    for (const source of detected) {
      const snapshot = await plugin.fetch(source, now).catch((error: unknown) => {
        problems++;
        return { status: `threw: ${error instanceof Error ? error.message : String(error)}`, limits: [], dataAsOf: now, plan: undefined, message: undefined };
      });
      const age = formatDuration(Math.max(0, now - snapshot.dataAsOf));
      console.log(`  ${source.label} ${DIM}${source.home}${OFF}`);
      console.log(`    status ${color(String(snapshot.status))}   plan ${snapshot.plan ?? '—'}   data ${age} old   detected ${formatDuration(now - source.lastModifiedMs)} old`);
      if (snapshot.message) console.log(`    message: ${snapshot.message}`);
      for (const limit of snapshot.limits) {
        const resets = limit.resetsAt === null ? 'no reset time' : new Date(limit.resetsAt).toLocaleString();
        console.log(`    ${limit.label}: ${limit.usedPercent ?? '—'}%  resets ${resets}`);
      }
      if (snapshot.status !== 'ok') problems++;
      else if (snapshot.limits.length === 0) {
        console.log(`    ${BAD}ok but no limits parsed — likely format drift${OFF}`);
        problems++;
      }
    }
  }

  console.log(problems === 0 ? `\n${OK}All sources readable.${OFF}` : `\n${WARN}${problems} source(s) need attention.${OFF}`);
  process.exitCode = problems === 0 ? 0 : 1;
}

await main();
