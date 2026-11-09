// Merges per-browser results files (one per CI job) into the published results the
// Storybook "Benchmarks" page reads: published/latest.json and
// published/argus-table@<version>.json (for a release build only).
//
//   node merge.ts results/                  # every results JSON in a folder (recursively)
//   node merge.ts a.json b.json c.json
//
// For each browser the newest file wins, so a folder of local runs works too.
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserName, Results } from './types.ts';
import { toMarkdown } from './markdown.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'published');

async function jsonFiles(path: string): Promise<string[]> {
  if (!(await stat(path)).isDirectory()) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((e) => e.isDirectory() || e.name.endsWith('.json'))
      .map((e) => jsonFiles(join(path, e.name))),
  );
  return nested.flat();
}

const isResults = (value: unknown): value is Results =>
  typeof value === 'object' &&
  value !== null &&
  'meta' in value &&
  'results' in value &&
  'pages' in value;

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) throw new Error('Usage: node merge.ts <results file or folder>...');
  const files = (await Promise.all(args.map(jsonFiles))).flat();
  const all: Results[] = [];
  for (const file of files) {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    // Older files (before load, sort and memory were measured) have no `pages`.
    if (isResults(parsed)) all.push(parsed);
    else process.stderr.write(`skipped ${file}: not a results file\n`);
  }
  if (!all.length) throw new Error('No results files found.');
  if (all.some((r) => r.meta.variants.length > 0))
    throw new Error('Results with VARIANTS compare playground versions; publish plain runs only.');

  // Newest first; each browser comes from the newest file that has it.
  all.sort((a, b) => b.meta.date.localeCompare(a.meta.date));
  const newest = all[0];
  if (!newest) throw new Error('No results files found.');
  const version = newest.meta.version;
  const taken = new Set<BrowserName>();
  const merged: Results = {
    meta: { ...newest.meta, versions: {} },
    results: [],
    pages: [],
  };
  for (const r of all) {
    if (r.meta.version !== version) continue;
    const browsers = (Object.keys(r.meta.versions) as BrowserName[]).filter((b) => !taken.has(b));
    for (const b of browsers) {
      taken.add(b);
      merged.meta.versions[b] = r.meta.versions[b];
      merged.results.push(...r.results.filter((x) => x.browser === b));
      merged.pages.push(...r.pages.filter((x) => x.browser === b));
    }
    merged.meta.runs = Math.min(merged.meta.runs, r.meta.runs);
    merged.meta.rows = [...new Set([...merged.meta.rows, ...r.meta.rows])].sort((a, b) => a - b);
  }
  // Group by row count, then browser, so the page and the summary read top to bottom.
  const order: BrowserName[] = ['chromium', 'firefox', 'webkit'];
  const byRowsThenBrowser = (
    a: { rows: number; browser: BrowserName },
    b: { rows: number; browser: BrowserName },
  ) => a.rows - b.rows || order.indexOf(a.browser) - order.indexOf(b.browser);
  merged.results.sort(byRowsThenBrowser);
  merged.pages.sort(byRowsThenBrowser);

  const prettier = await import('prettier');
  const write = async (name: string) => {
    const path = join(outDir, name);
    const options = (await prettier.resolveConfig(path)) ?? {};
    await writeFile(
      path,
      await prettier.format(JSON.stringify(merged), { ...options, filepath: path }),
    );
    return path;
  };
  await mkdir(outDir, { recursive: true });
  const written = [await write('latest.json')];
  // Unreleased builds (`0.2.0+<commit>`) only update latest.json.
  if (!version.includes('+')) written.push(await write(`argus-table@${version}.json`));
  process.stdout.write(`${toMarkdown(merged)}\nWrote ${written.join(', ')}\n`);
}

await main();
