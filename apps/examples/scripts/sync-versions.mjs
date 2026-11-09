// Sets each starter's dependency on a published package to `^<its version>`.
// The starters live outside the pnpm workspace (StackBlitz installs them with
// npm), so changesets doesn't bump them; the root `version-packages` script
// runs this after `changeset version`. With --check it only reports drift and
// exits 1, for `lint`.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { packages, starters } from '../starters.mjs';

const examples = fileURLToPath(new URL('..', import.meta.url));
const repo = join(examples, '../..');
const check = process.argv.includes('--check');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const versions = {};
for (const [name, dir] of Object.entries(packages)) {
  versions[name] = (await readJson(join(repo, dir, 'package.json'))).version;
}

const drift = [];
for (const { name } of starters) {
  const file = join(examples, name, 'package.json');
  const pkg = await readJson(file);
  let changed = false;
  for (const field of ['dependencies', 'devDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      const want = versions[dep] && `^${versions[dep]}`;
      if (want && pkg[field][dep] !== want) {
        drift.push(`${name}: ${dep} is ${pkg[field][dep]}, expected ${want}`);
        pkg[field][dep] = want;
        changed = true;
      }
    }
  }
  if (changed && !check) await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

if (check && drift.length > 0) {
  console.error(
    `Starter versions are out of date (run pnpm --filter @argus-table/examples sync-versions):\n  ${drift.join('\n  ')}`,
  );
  process.exit(1);
}
if (!check) for (const line of drift) console.log(`updated ${line}`);
