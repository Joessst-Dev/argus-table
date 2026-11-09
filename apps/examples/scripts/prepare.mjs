// Prepares the smoke test: packs the published packages as npm would get them,
// then installs and builds each starter in .smoke/<name> against those
// tarballs, with npm (as StackBlitz and most users do). The starters'
// own folders stay untouched.
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { packages, starters } from '../starters.mjs';

const run = promisify(execFile);
const examples = fileURLToPath(new URL('..', import.meta.url));
const repo = join(examples, '../..');
const smoke = join(examples, '.smoke');
const tarballs = join(smoke, 'tarballs');

await rm(smoke, { recursive: true, force: true });
await mkdir(tarballs, { recursive: true });

// 1. Pack. pnpm turns `workspace:*` into the real version, as on publish.
const specs = {};
for (const [name, dir] of Object.entries(packages)) {
  const before = new Set(await readdir(tarballs));
  await run('pnpm', ['pack', '--pack-destination', tarballs], { cwd: join(repo, dir) });
  const file = (await readdir(tarballs)).find((f) => !before.has(f));
  if (!file) throw new Error(`pnpm pack wrote no tarball for ${name}`);
  specs[name] = `file:../tarballs/${file}`;
}
console.log(`packed ${Object.keys(specs).join(', ')}`);

// 2. Copy each starter and point it at the tarballs. The overrides also catch
//    the wrappers' own dependency on argus-table (npm requires an override of a
//    direct dependency to repeat its spec exactly).
async function prepare(name) {
  const dir = join(smoke, name);
  await cp(join(examples, name), dir, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist|\.angular)$/.test(src),
  });
  const file = join(dir, 'package.json');
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  for (const field of ['dependencies', 'devDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (specs[dep]) pkg[field][dep] = specs[dep];
    }
  }
  pkg.overrides = { ...specs };
  await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);

  // 3. Install and build (each build typechecks the starter).
  const started = Date.now();
  try {
    await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir });
    await run('npm', ['run', 'build'], {
      cwd: dir,
      env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
    });
  } catch (error) {
    const { stdout = '', stderr = '' } = error;
    const output = `${stdout}${stderr}`.trim().replace(/^/gm, `[${name}] `);
    throw new Error(`${name} starter failed: ${error.message.split('\n')[0]}\n${output}`, {
      cause: error,
    });
  }
  console.log(`built ${name} in ${String(Math.round((Date.now() - started) / 1000))} s`);
}

const results = await Promise.allSettled(starters.map(({ name }) => prepare(name)));
const failures = results.filter((r) => r.status === 'rejected');
for (const failure of failures) console.error(failure.reason.message);
if (failures.length > 0) process.exit(1);
