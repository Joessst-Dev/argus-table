// Every example on a feature page has all four flavours, and every example is
// used (docs/superpowers/specs/2026-11-16-docs-site-design.md, "CI
// enforcement"). Runs in `lint`, before any build: node:fs only.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
 * The problems in a site folder (`root` holds `src/examples` and
 * `src/content/docs/features`), one message each; empty when all is well.
 * @param {string} root
 * @returns {string[]}
 */
export function checkExamples(root) {
  const problems = [];
  const examples = new Set();
  const examplesDir = join(root, 'src/examples');
  for (const feature of dirs(examplesDir)) {
    for (const example of dirs(join(examplesDir, feature))) {
      const id = `${feature}/${example}`;
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
        else if (components.length > 1)
          problems.push(`${where}/${flavour}: more than one component`);
      }
    }
  }
  const used = new Set();
  const pagesDir = join(root, 'src/content/docs/features');
  const pages = existsSync(pagesDir) ? readdirSync(pagesDir).filter((n) => /\.mdx?$/.test(n)) : [];
  for (const page of pages.sort()) {
    const text = readFileSync(join(pagesDir, page), 'utf8');
    for (const [, id] of text.matchAll(/<FlavourTabs\b[^>]*\bexample="([^"]+)"/g)) {
      used.add(id);
      if (!examples.has(id)) {
        problems.push(`src/content/docs/features/${page}: example "${id}" does not exist`);
      }
    }
  }
  for (const id of [...examples].sort()) {
    if (!used.has(id)) problems.push(`src/examples/${id}: not used on any feature page`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkExamples(join(dirname(fileURLToPath(import.meta.url)), '..'));
  for (const problem of problems) console.error(problem);
  process.exitCode = problems.length > 0 ? 1 : 0;
}
