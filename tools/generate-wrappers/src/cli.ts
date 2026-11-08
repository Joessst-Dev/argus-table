#!/usr/bin/env node
// generate-wrappers <framework> [--check]
//
// Reads packages/table/dist/custom-elements.json (build argus-table first) and
// writes packages/<framework>/src/generated/elements.ts. With --check it only
// compares, and exits 1 when the committed file is out of date.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, FRAMEWORKS, type Framework } from './generate.ts';
import type { Manifest } from './manifest.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const manifestPath = resolve(root, 'packages/table/dist/custom-elements.json');

const [arg = '', ...flags] = process.argv.slice(2);
const check = flags.includes('--check');

const isFramework = (name: string): name is Framework =>
  (FRAMEWORKS as readonly string[]).includes(name);
if (!isFramework(arg)) {
  console.error(`Usage: generate-wrappers <${FRAMEWORKS.join('|')}> [--check]`);
  process.exit(2);
}
const framework = arg;

let manifest: Manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
} catch {
  console.error(`Can't read ${manifestPath}. Build argus-table first: pnpm nx build argus-table`);
  process.exit(2);
}

const outFile = resolve(root, `packages/${framework}/src/generated/elements.ts`);
const source = await generate(framework, manifest, outFile);

if (check) {
  const current = await readFile(outFile, 'utf8').catch(() => '');
  if (current !== source) {
    console.error(
      `${outFile} is out of date with argus-table's manifest. Run: pnpm --filter @argus-table/${framework} generate`,
    );
    process.exit(1);
  }
} else {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, source);
  console.log(`Wrote ${outFile}`);
}
