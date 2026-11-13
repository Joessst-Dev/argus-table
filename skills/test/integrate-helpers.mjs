// Shared by the argus-table-integrate tests: running a script as an agent
// does, and copying a fixture project to a temporary folder (where tests can
// add node_modules and lockfiles without committing them).
import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
export const fixtures = join(here, 'fixtures', 'integrate');
export const scripts = join(here, '..', 'argus-table-integrate', 'scripts');
export const repo = join(here, '..', '..');
const run = promisify(execFile);

/** Runs a script; resolves with its output and exit code, also on failure. */
export async function node(script, args, options = {}) {
  try {
    const { stdout, stderr } = await run(process.execPath, [join(scripts, script), ...args], {
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, code: error.code };
  }
}

/** Runs a script that prints JSON, and parses it. */
export async function nodeJson(script, args, options) {
  const result = await node(script, args, options);
  if (result.code !== 0 && result.code !== 1)
    throw new Error(`${script} exited ${String(result.code)}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

/** A temporary copy of a fixture (or an empty folder), with extra files. */
export function project(fixture, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'argus-integrate-'));
  if (fixture) cpSync(join(fixtures, fixture), dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(
      join(dir, path),
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    );
  }
  return dir;
}

/** `{ "argus-table": "1.1.2" }` → node_modules/<name>/package.json files for project(). */
export function installed(versions, prefix = '') {
  const files = {};
  for (const [name, version] of Object.entries(versions)) {
    files[`${prefix}node_modules/${name}/package.json`] = { name, version };
  }
  return files;
}
