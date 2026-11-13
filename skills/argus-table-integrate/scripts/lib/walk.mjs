// Walking a project's source files, stripping comments without moving
// offsets, mapping offsets to lines, and following imports one hop.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

/** Folders that never hold the app's own source. */
export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.angular',
  '.vercel',
  '.netlify',
  'coverage',
  '.turbo',
  '.nx',
  '.cache',
  '.parcel-cache',
  'storybook-static',
  'vendor',
  'tmp',
  'target',
  'bin',
  'obj',
  '.yarn',
  '.pnpm-store',
  '.idea',
  '.vscode',
]);

export const SCRIPT_EXTS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
export const MARKUP_EXTS = new Set(['.vue', '.svelte', '.html', '.htm', '.astro']);
export const STYLE_EXTS = new Set(['.css', '.scss', '.sass', '.less']);

/** A source file of interest: scripts, markup, styles (not declarations, minified files or maps). */
export function isSource(path) {
  const ext = extname(path).toLowerCase();
  if (/\.d\.[mc]?ts$|\.min\.(?:js|css)$|\.map$/i.test(path)) return false;
  return SCRIPT_EXTS.has(ext) || MARKUP_EXTS.has(ext) || STYLE_EXTS.has(ext);
}

/**
 * Lists source files under `root`, sorted, without following symlinks.
 * Stops at `maxFiles` (then `truncated`), skips files over `maxBytes`.
 */
export function walk(
  root,
  { ignore = [], maxFiles = 20000, maxBytes = 512 * 1024, maxDepth = 25 } = {},
) {
  const ignored = new Set([...IGNORED_DIRS, ...ignore]);
  const files = [];
  let visited = 0;
  let skippedLarge = 0;
  let truncated = false;
  const visit = (dir, depth) => {
    if (truncated || depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (truncated) return;
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (ignored.has(entry.name) || ignore.includes(relative(root, path))) continue;
        visit(path, depth + 1);
      } else if (entry.isFile() && isSource(path)) {
        if (++visited > maxFiles) {
          truncated = true;
          return;
        }
        let size;
        try {
          size = statSync(path).size;
        } catch {
          continue;
        }
        if (size > maxBytes) {
          skippedLarge++;
          continue;
        }
        files.push(path);
      }
    }
  };
  visit(root, 0);
  return { files, visited: Math.min(visited, maxFiles), skippedLarge, truncated };
}

/** `text` with every regular-expression metacharacter escaped, for `new RegExp()`. */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/** Reads a file as UTF-8, or `undefined`. */
export function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** Reads JSON, also with comments and trailing commas (tsconfig); `undefined` if it isn't JSON. */
export function readJson(path) {
  const text = read(path);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(stripJsComments(text).replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      return undefined;
    }
  }
}

/** `a/b/c` with forward slashes, relative to `root`. */
export function rel(root, path) {
  return relative(root, path).split(sep).join('/');
}

/**
 * Blanks out JavaScript comments (keeping newlines, so offsets and lines stay
 * put). Strings and template literals are kept: feature keys live in them.
 */
export function stripJsComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  // Template literal nesting: a stack of brace depths at which a `${` opened.
  const templates = [];
  let braces = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (templates.length && templates[templates.length - 1] === braces && c === '}') {
      // Back into the template literal.
      templates.pop();
      out += c;
      i++;
      i = readTemplate(i);
      continue;
    }
    if (c === '/' && d === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '`') {
      out += c;
      i = readTemplate(i + 1);
    } else {
      if (c === '{') braces++;
      else if (c === '}') braces--;
      out += c;
      i++;
    }
  }
  return out;

  function readTemplate(start) {
    let j = start;
    while (j < n) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (src[j] === '`') {
        out += src.slice(start, j + 1);
        return j + 1;
      }
      if (src[j] === '$' && src[j + 1] === '{') {
        out += src.slice(start, j + 2);
        templates.push(braces);
        return j + 2;
      }
      j++;
    }
    out += src.slice(start);
    return n;
  }
}

/** Blanks out HTML comments, keeping offsets. */
export function stripHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Comments blanked out for any source file: markup comments, and JS comments in scripts. */
export function stripComments(src, path) {
  const ext = extname(path).toLowerCase();
  if (SCRIPT_EXTS.has(ext)) return stripJsComments(src);
  if (STYLE_EXTS.has(ext)) {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  }
  let text = stripHtmlComments(src);
  // Scripts inside markup: strip their JS comments in place.
  text = text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (_, open, body, close) => {
    return open + stripJsComments(body) + close;
  });
  if (ext === '.astro' || ext === '.svelte') {
    text = text.replace(/^---\n([\s\S]*?)\n---/, (m, body) => `---\n${stripJsComments(body)}\n---`);
  }
  return text;
}

/** Maps offsets to 1-based line numbers. */
export function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** Module specifiers a file imports (static, dynamic, require, re-exports), with offsets. */
export function importsOf(src) {
  const found = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /@import\s+(?:url\()?['"]([^'"\n]+)['"]/g,
    /@use\s+['"]([^'"\n]+)['"]/g,
  ];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) found.push({ spec: m[1], index: m.index ?? 0, text: m[0] });
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Names imported from a module: `import { A, type B as C } from 'x'` → `['A', 'B']`, plus a default. */
export function namedImports(src, spec) {
  const names = [];
  const escaped = escapeRegExp(spec);
  const re = new RegExp(
    `\\bimport\\s+(?:type\\s+)?([\\w$]+)?\\s*,?\\s*(?:\\{([^}]*)\\})?\\s*from\\s+['"]${escaped}['"]`,
    'g',
  );
  for (const m of src.matchAll(re)) {
    if (m[1] && m[1] !== 'type') names.push({ name: m[1], default: true });
    for (const part of (m[2] ?? '').split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name) names.push({ name, default: false });
    }
  }
  return names;
}

const RESOLVE_EXTS = [
  '.ts',
  '.tsx',
  '.mts',
  '.js',
  '.jsx',
  '.mjs',
  '.vue',
  '.svelte',
  '.cts',
  '.cjs',
];

/**
 * Resolves a module specifier to a file in the project: relative paths,
 * tsconfig/jsconfig `paths`, and the usual `@/` and `~/` aliases.
 */
export function makeResolver(projectDir) {
  const aliases = readAliases(projectDir);
  const tryFile = (base) => {
    const candidates = [base, ...RESOLVE_EXTS.map((e) => base + e)];
    // `./file.js` written for a `.ts` file (TS with NodeNext).
    if (/\.[mc]?js$/.test(base)) {
      const stem = base.replace(/\.([mc]?)js$/, '');
      candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`);
    }
    candidates.push(...RESOLVE_EXTS.map((e) => join(base, `index${e}`)));
    for (const c of candidates) {
      try {
        if (statSync(c).isFile()) return c;
      } catch {
        // next
      }
    }
    return undefined;
  };
  return (spec, fromFile) => {
    if (spec.startsWith('.')) return tryFile(resolve(dirname(fromFile), spec));
    if (spec.startsWith('/')) return tryFile(join(projectDir, spec));
    for (const [prefix, targets] of aliases) {
      if (spec === prefix.replace(/\/$/, '') || spec.startsWith(prefix)) {
        for (const target of targets) {
          const hit = tryFile(join(target, spec.slice(prefix.length)));
          if (hit) return hit;
        }
      }
    }
    return undefined;
  };
}

function readAliases(projectDir) {
  const aliases = [];
  for (const name of ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json']) {
    const config = readJson(join(projectDir, name));
    const options = config?.compilerOptions;
    if (!options?.paths) continue;
    const base = resolve(projectDir, options.baseUrl ?? '.');
    for (const [pattern, targets] of Object.entries(options.paths)) {
      if (!Array.isArray(targets)) continue;
      const prefix = pattern.replace(/\*$/, '');
      aliases.push([prefix, targets.map((t) => resolve(base, String(t).replace(/\*$/, '')))]);
    }
  }
  const src = join(projectDir, 'src');
  const srcDir = existsSync(src) ? src : projectDir;
  aliases.push(['@/', [srcDir]], ['~/', [srcDir, projectDir]], ['~~/', [projectDir]]);
  return aliases;
}
