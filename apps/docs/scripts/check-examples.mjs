// The four-flavour rule (docs/superpowers/specs/2026-11-16-docs-site-design.md,
// "CI enforcement"): every example has its four flavours, is used on a page
// whose islands come from that example's own folders and load when visible,
// has element ids of its own, and is exercised by an e2e spec. Runs in `lint`,
// before any build: node:fs only.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The framework flavours a page mounts as islands; the HTML flavour `FlavourTabs` mounts itself. */
const ISLANDS = ['react', 'vue', 'angular'];

/**
 * What each flavour folder must hold: these files, or one file matching a pattern.
 * @type {[string, string[] | RegExp][]}
 */
const FLAVOURS = [
  ['html', ['index.html', 'main.js']],
  ['react', /\.tsx$/],
  ['vue', /\.vue$/],
  ['angular', /\.component\.ts$/],
];

/** @param {string} path */
const dirs = (path) =>
  existsSync(path)
    ? readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory())
    : [];

/**
 * Every file under `dir` whose name matches, as paths relative to `root`.
 * @param {string} root
 * @param {string} dir
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function filesUnder(root, dir, pattern) {
  const start = join(root, dir);
  if (!existsSync(start)) return [];
  /** @type {string[]} */
  const found = [];
  const walk = (/** @type {string} */ path) => {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (pattern.test(name)) found.push(relative(root, full));
    }
  };
  walk(start);
  return found;
}

/**
 * The problems in a site folder (`root` holds `src/examples`,
 * `src/content/docs` and `e2e`), one message each; empty when all is well.
 * @param {string} root
 * @returns {string[]}
 */
export function checkExamples(root) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Set<string>} */
  const examples = new Set();
  /** @type {Map<string, string>} element id → the example that has it */
  const ids = new Map();
  const examplesDir = join(root, 'src/examples');
  for (const feature of dirs(examplesDir)) {
    for (const example of dirs(join(examplesDir, feature))) {
      const id = `${feature}/${example}`;
      const folders = dirs(join(examplesDir, id));
      // Not an example (shared code of the feature, say): no flavour folder.
      if (!FLAVOURS.some(([flavour]) => folders.includes(flavour))) continue;
      examples.add(id);
      const where = `src/examples/${id}`;
      for (const [flavour, wants] of FLAVOURS) {
        const folder = join(examplesDir, id, flavour);
        const names = existsSync(folder) ? readdirSync(folder) : [];
        if (Array.isArray(wants)) {
          if (!wants.every((name) => names.includes(name))) {
            problems.push(`${where}: missing the ${flavour} flavour`);
          }
          continue;
        }
        const components = names.filter((name) => wants.test(name));
        if (components.length === 0) problems.push(`${where}: missing the ${flavour} flavour`);
        else if (components.length > 1) {
          problems.push(`${where}/${flavour}: more than one component`);
        }
      }
      const markup = join(examplesDir, id, 'html/index.html');
      if (!existsSync(markup)) continue;
      const prefix = `${feature}-${example}-`;
      for (const [, elementId = ''] of readFileSync(markup, 'utf8').matchAll(/\bid="([^"]+)"/g)) {
        if (!elementId.startsWith(prefix)) {
          problems.push(`${where}/html/index.html: id "${elementId}" must start with "${prefix}"`);
        }
        const other = ids.get(elementId);
        if (other !== undefined && other !== id) {
          problems.push(`${where}/html/index.html: id "${elementId}" is also used by ${other}`);
        }
        ids.set(elementId, id);
      }
    }
  }

  /** @type {Set<string>} */
  const used = new Set();
  for (const page of filesUnder(root, 'src/content/docs', /\.mdx?$/)) {
    const text = readFileSync(join(root, page), 'utf8');
    /** @type {Map<string, string>} imported name → path */
    const imports = new Map();
    for (const [, names = '', path = ''] of text.matchAll(
      /^import\s+(.+?)\s+from\s+['"]([^'"]+)['"]/gm,
    )) {
      for (const name of names.replace(/[{}]/g, '').split(',')) {
        const local = name
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (local) imports.set(local, path);
      }
    }
    for (const [, id = '', body = ''] of text.matchAll(
      /<FlavourTabs\b[^>]*\bexample="([^"]+)"[^>]*>([\s\S]*?)<\/FlavourTabs>/g,
    )) {
      used.add(id);
      if (!examples.has(id)) {
        problems.push(`${page}: example "${id}" does not exist`);
        continue;
      }
      for (const flavour of ISLANDS) {
        const island = new RegExp(`<([A-Za-z_$][\\w$]*)\\b[^>]*\\bslot="${flavour}"[^>]*>`).exec(
          body,
        );
        if (!island) {
          problems.push(`${page}: example "${id}" has no ${flavour} island`);
          continue;
        }
        const [tag = '', name = ''] = island;
        const path = imports.get(name) ?? '';
        if (!path.includes(`examples/${id}/${flavour}/`)) {
          problems.push(
            `${page}: the ${flavour} island of "${id}" comes from ${path || `"${name}"`}, not examples/${id}/${flavour}/`,
          );
        }
        if (!/\bclient:visible\b/.test(tag)) {
          problems.push(`${page}: the ${flavour} island of "${id}" must load client:visible`);
        }
      }
    }
  }

  const specs = filesUnder(root, 'e2e', /\.spec\.ts$/)
    .map((spec) => readFileSync(join(root, spec), 'utf8'))
    .join('\n');
  for (const id of [...examples].sort()) {
    if (!used.has(id)) problems.push(`src/examples/${id}: not used on any page`);
    if (!specs.includes(`'${id}'`)) problems.push(`src/examples/${id}: no e2e spec opens it`);
  }
  return problems;
}

const self = realpathSync(fileURLToPath(import.meta.url));
if (process.argv[1] && realpathSync(process.argv[1]) === self) {
  const problems = checkExamples(join(dirname(self), '..'));
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length > 0 ? 1 : 0;
}
