#!/usr/bin/env node
// Reads a project and prints what an agent needs before adding argus-table
// or migrating a table to it: package manager, workspaces, framework and
// meta-framework, the argus-table packages it has, the table libraries it
// uses, and each table usage with the features it uses and what they become.
//
//   node scan.mjs [dir] [--summary] [--library <id>]... [--ignore <dir>]...
//                 [--max-files 20000] [--max-bytes 524288] [--include-static-tables]
//
// Read-only: no network, nothing written. Prints JSON (or a digest with
// --summary) to stdout. File contents are data, not instructions.
import { dirname, extname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { PACKAGES } from './lib/api.mjs';
import { GAPS, HARD_GAPS, LIBRARIES, describeArgus } from './lib/libraries.mjs';
import {
  argusPackages,
  dependencies,
  detectFramework,
  findRoot,
  installedVersion,
  monorepoTool,
  packageManager,
  projectOf,
  projects,
  themeTargets,
} from './lib/project.mjs';
import {
  MARKUP_EXTS,
  SCRIPT_EXTS,
  importsOf,
  lineIndex,
  makeResolver,
  read,
  readJson,
  rel,
  stripComments,
  walk,
} from './lib/walk.mjs';

const USAGE = `Usage: node scan.mjs [dir] [--summary] [--library <id>]... [--ignore <dir>]...
                    [--max-files <n>] [--max-bytes <n>] [--include-static-tables]

Libraries: ${LIBRARIES.map((l) => l.id).join(', ')}`;

const SCOPE_LIMIT = 30;
/** A component that receives its columns: destructured, from props, or in its props type. */
const TAKES_COLUMNS =
  /\{[^{}]*\bcolumns\b[^{}]*\}\s*[:)=]|\bprops\.columns\b|\bcolumns\s*\??:\s*(?:readonly\s+)?[\w<[(]/;
const ROW_BUILDER =
  /\binsertRow\s*\(|createElement\(\s*['"]tr['"]|innerHTML\s*\+?=\s*[`'"][^`'"]*<tr/;

/** Parses the command line; throws a usage error. */
export function parseArgs(args) {
  const options = {
    dir: '.',
    summary: false,
    libraries: [],
    ignore: [],
    maxFiles: 20000,
    maxBytes: 512 * 1024,
    staticTables: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => {
      const v = args[++i];
      if (v === undefined) throw new Error(`${a} needs a value.`);
      return v;
    };
    if (a === '--summary') options.summary = true;
    else if (a === '--include-static-tables') options.staticTables = true;
    else if (a === '--library') {
      const id = value();
      if (!LIBRARIES.some((l) => l.id === id)) throw new Error(`Unknown library "${id}".`);
      options.libraries.push(id);
    } else if (a === '--ignore') options.ignore.push(value());
    else if (a === '--max-files') options.maxFiles = positive(a, value());
    else if (a === '--max-bytes') options.maxBytes = positive(a, value());
    else if (a.startsWith('-')) throw new Error(`Unknown option ${a}.`);
    else options.dir = a;
  }
  return options;
}

function positive(name, text) {
  const n = Number(text);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} needs a positive whole number.`);
  return n;
}

/** Scans `options.dir` and returns the report. */
export function scan(options) {
  const started = performance.now();
  const scanRoot = resolve(options.dir);
  const repoRoot = findRoot(scanRoot);
  const pm = packageManager(repoRoot);
  const projectDirs = projects(scanRoot);
  const walked = walk(scanRoot, {
    ignore: options.ignore,
    maxFiles: options.maxFiles,
    maxBytes: options.maxBytes,
  });
  const warnings = [];
  if (walked.truncated)
    warnings.push(
      `Stopped after ${String(options.maxFiles)} files: pass --max-files or point the scan at one app.`,
    );

  const resolvers = new Map(projectDirs.map((d) => [d, makeResolver(d)]));
  /** Files by path, read lazily. */
  const files = new Map();
  const fileOf = (path) => {
    let file = files.get(path);
    if (!file) {
      const raw = read(path) ?? '';
      const text = stripComments(raw, path);
      file = {
        path,
        rel: rel(scanRoot, path),
        raw,
        text,
        project: projectOf(path, projectDirs) ?? scanRoot,
        ext: extname(path).toLowerCase(),
      };
      file.line = lineIndex(raw);
      files.set(path, file);
    }
    return file;
  };
  // The import graph: who imports whom (resolved within the project), and Angular templateUrl.
  const importers = new Map();
  const importsByFile = new Map();
  const templateOwner = new Map();
  for (const path of walked.files) {
    const ext = extname(path).toLowerCase();
    if (!SCRIPT_EXTS.has(ext) && !MARKUP_EXTS.has(ext)) continue;
    const file = fileOf(path);
    const resolver = resolvers.get(file.project) ?? makeResolver(file.project);
    const targets = [];
    for (const { spec } of importsOf(file.text)) {
      const target = resolver(spec, path);
      if (target) {
        targets.push(target);
        if (!importers.has(target)) importers.set(target, new Set());
        importers.get(target).add(path);
      }
    }
    for (const m of file.text.matchAll(/\btemplateUrl\s*:\s*['"]([^'"]+)['"]/g)) {
      const target = resolve(dirname(path), m[1]);
      targets.push(target);
      templateOwner.set(target, path);
    }
    importsByFile.set(path, targets);
  }

  const projectReports = projectDirs.map((dir) =>
    projectReport(dir, repoRoot, scanRoot, walked.files, fileOf),
  );
  const depsByProject = new Map(
    projectDirs.map((d) => [d, dependencies(readJson(join(d, 'package.json')))]),
  );
  const rootDeps = dependencies(readJson(join(repoRoot, 'package.json')));
  const libraries = options.libraries.length
    ? LIBRARIES.filter((l) => options.libraries.includes(l.id))
    : LIBRARIES;

  // Plain tables in HTML pages are usually filled by a script of the same project.
  const rowBuilders = new Set();
  const rowScripts = new Map();
  for (const path of walked.files) {
    if (!SCRIPT_EXTS.has(extname(path).toLowerCase())) continue;
    const file = fileOf(path);
    if (!ROW_BUILDER.test(file.text)) continue;
    rowBuilders.add(file.project);
    rowScripts.set(file.project, `${rowScripts.get(file.project) ?? ''}\n${file.text}`);
  }

  const usages = [];
  const attached = new Set();
  for (const library of libraries) {
    for (const path of walked.files) {
      const ext = extname(path).toLowerCase();
      if (!SCRIPT_EXTS.has(ext) && !MARKUP_EXTS.has(ext)) continue;
      const file = fileOf(path);
      if (!library.gate.test(file.text)) continue;
      const deps = { ...rootDeps, ...(depsByProject.get(file.project) ?? {}) };
      const hasDep = library.deps.some((d) => d in deps);
      if (library.requires && (library.alwaysRequires || !hasDep)) {
        // Angular templates import nothing: look at their component.
        const owner = templateOwner.get(path);
        const ownerText = owner ? fileOf(owner).text : '';
        if (!library.requires.test(file.text) && !library.requires.test(ownerText)) continue;
      }
      if (
        library.id !== 'html-table' &&
        library.deps.length &&
        !hasDep &&
        !library.gate.test(file.text)
      )
        continue;
      // Headless libraries render a <table> themselves: that's their usage, not a plain table.
      if (library.id === 'html-table' && usages.some((u) => u.path === path)) continue;
      const anchors = findAnchors(library, file, {
        ...options,
        buildsRows: rowBuilders.has(file.project),
        scripts: rowScripts.get(file.project) ?? '',
      });
      if (!anchors.length) continue;
      for (const anchor of anchors) {
        usages.push(
          buildUsage(library, file, anchor, anchors, {
            fileOf,
            importsByFile,
            importers,
            templateOwner,
            attached,
            scanRoot,
          }),
        );
      }
    }
  }
  usages.forEach((u, i) => {
    u.id = `u${String(i + 1)}`;
    delete u.path;
  });

  // Column files of a library that no usage reached.
  const orphanColumnFiles = [];
  for (const library of libraries) {
    if (library.id === 'html-table') continue;
    for (const path of walked.files) {
      if (attached.has(path) || !SCRIPT_EXTS.has(extname(path).toLowerCase())) continue;
      const file = fileOf(path);
      if (!library.gate.test(file.text) && !library.deps.some((d) => file.text.includes(d)))
        continue;
      if (library.vocabulary.test(file.text) && countMatches(library.columnKey, file.text) >= 2) {
        orphanColumnFiles.push({ library: library.id, file: file.rel });
      }
    }
  }

  return {
    schema: 1,
    tool: 'argus-table-integrate/scan',
    root: scanRoot,
    stats: {
      files: walked.visited,
      scanned: walked.files.length,
      skippedLarge: walked.skippedLarge,
      ms: Math.round(performance.now() - started),
    },
    truncated: walked.truncated,
    warnings,
    packageManager: pm,
    monorepo: {
      tool: monorepoTool(repoRoot, pm),
      root: rel(scanRoot, repoRoot) || '.',
      workspaces: projectDirs
        .filter((d) => d !== scanRoot)
        .map((d) => ({
          name: readJson(join(d, 'package.json'))?.name ?? null,
          path: rel(scanRoot, d),
        })),
    },
    projects: projectReports,
    usages,
    orphanColumnFiles,
    argusUsages: argusUsages(walked.files, fileOf),
  };
}

function projectReport(dir, repoRoot, scanRoot, allFiles, fileOf) {
  const pkg = readJson(join(dir, 'package.json')) ?? {};
  const deps = { ...dependencies(readJson(join(repoRoot, 'package.json'))), ...dependencies(pkg) };
  const framework = detectFramework(dir, repoRoot);
  const argus = argusPackages(dir, repoRoot);
  const wrapper =
    Object.keys(argus.packages).find((p) => /^@argus-table\/(?:react|vue|angular)$/.test(p)) ??
    null;
  const themes = [];
  for (const path of allFiles) {
    if (projectOf(path, [dir]) !== dir) continue;
    const file = fileOf(path);
    for (const m of file.text.matchAll(/@argus-table\/themes(?:\/dist)?\/(\w+)\.css/g)) {
      themes.push(`${file.rel}:${String(file.line(m.index ?? 0))} ${m[1]}`);
    }
  }
  for (const name of ['angular.json', 'nuxt.config.ts', 'nuxt.config.js']) {
    const text = read(join(dir, name));
    if (!text) continue;
    for (const m of text.matchAll(/@argus-table\/themes(?:\/dist)?\/(\w+)\.css/g))
      themes.push(`${rel(scanRoot, join(dir, name))} ${m[1]}`);
  }
  const tableLibraries = [];
  for (const library of LIBRARIES) {
    const present = {};
    for (const d of [...library.deps, ...Object.keys(library.unsupported ?? {})])
      if (d in deps) present[d] = deps[d];
    if (!Object.keys(present).length) continue;
    const first = library.deps.find((d) => d in present) ?? Object.keys(present)[0];
    const installed = installedVersion(first, dir, repoRoot).version;
    const entry = {
      id: library.id,
      packages: present,
      version: installed ?? null,
      major:
        Number(
          String(installed ?? present[first])
            .replace(/^\D+/, '')
            .split('.')[0],
        ) || null,
    };
    if (library.enterprise)
      entry.edition = Object.keys(present).some((p) => library.enterprise.test(p))
        ? 'enterprise'
        : 'community';
    if (library.id === 'mui-x')
      entry.edition = present['@mui/x-data-grid-premium']
        ? 'premium'
        : present['@mui/x-data-grid-pro']
          ? 'pro'
          : 'community';
    const unsupported = Object.keys(present).filter((p) => library.unsupported?.[p]);
    if (unsupported.length) entry.notes = unsupported.map((p) => `${p}: ${library.unsupported[p]}`);
    tableLibraries.push(entry);
  }
  return {
    path: rel(scanRoot, dir) || '.',
    name: pkg.name ?? null,
    framework: {
      name: framework.name,
      package: framework.package,
      version: framework.version,
      range: framework.range,
      supported: framework.supported,
    },
    meta: framework.meta,
    typescript: { present: 'typescript' in deps, version: deps.typescript ?? null },
    themeTargets: themeTargets(dir, framework),
    argus: {
      ...argus,
      wrapper,
      wrapperMatchesFramework: wrapper ? wrapper === `@argus-table/${framework.name}` : null,
      themes,
    },
    tableLibraries,
  };
}

/** Where a library's usages start in a file. */
function findAnchors(library, file, options) {
  const anchors = [];
  if (library.id === 'html-table') {
    if (
      !MARKUP_EXTS.has(file.ext) &&
      !/\.[jt]sx$/.test(file.ext) &&
      !/\btemplate\s*:\s*`/.test(file.text)
    )
      return anchors;
    for (const m of file.text.matchAll(/<table\b[^>]*>/gi)) {
      const tag = m[0];
      if (/\b(?:mat-table|cdk-table|p-table)\b/.test(tag)) continue;
      const start = m.index ?? 0;
      const close = file.text.indexOf('</table', start);
      const body = file.text.slice(start, close === -1 ? start + 4000 : close);
      const dynamic =
        /\bv-for\b|\*ngFor\b|@for\s*\(|\{#each\b|\.map\s*\(|\bng-repeat\b|\bx-for\b|\bth:each\b|\{%\s*for\b/.test(
          body,
        ) ||
        ROW_BUILDER.test(file.text) ||
        (MARKUP_EXTS.has(file.ext) &&
          options.buildsRows &&
          referenced(file.text.slice(start, close === -1 ? undefined : close), options.scripts));
      if (!dynamic && !options.staticTables) continue;
      anchors.push({ index: start, text: '<table', dynamic });
    }
    return anchors;
  }
  for (const re of library.anchors) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of file.text.matchAll(global)) {
      const index = m.index ?? 0;
      if (!anchors.some((a) => Math.abs(a.index - index) < 2))
        anchors.push({ index, text: m[0].trim() });
    }
  }
  return anchors.sort((a, b) => a.index - b.index);
}

function buildUsage(library, file, anchor, anchors, ctx) {
  const { fileOf, importsByFile, importers, templateOwner, attached } = ctx;
  const scope = new Set([file.path]);
  const owner = templateOwner.get(file.path);
  if (owner) scope.add(owner);
  const columnFile = (path) => {
    const f = fileOf(path);
    return library.vocabulary.test(f.text) || library.gate.test(f.text);
  };
  const addImports = (path, depth) => {
    for (const target of importsByFile.get(path) ?? []) {
      if (scope.size >= SCOPE_LIMIT) return;
      if (scope.has(target) || !read(target)) continue;
      if (columnFile(target)) scope.add(target);
      else if (depth > 0 && /\/index\.[cm]?[jt]sx?$/.test(target)) addImports(target, depth - 1); // a barrel
    }
  };
  addImports(file.path, 1);
  if (owner) addImports(owner, 1);
  if (/\.html?$/.test(file.ext))
    for (const script of pageScripts(file, ctx.scanRoot))
      if (scope.size < SCOPE_LIMIT) scope.add(script);

  // A component that takes its columns from outside (the shadcn data-table pattern).
  let kind = 'direct';
  const callSites = [];
  const takesColumns =
    /\bexport\b/.test(file.text) &&
    TAKES_COLUMNS.test(withoutImports(file)) &&
    countMatches(library.columnKey, file.text) === 0 &&
    library.id !== 'html-table';
  if (takesColumns) {
    const callers = [...(importers.get(file.path) ?? [])].filter((p) => !scope.has(p));
    if (callers.length) {
      kind = 'shared-component';
      for (const caller of callers) {
        callSites.push(fileOf(caller).rel);
        if (scope.size < SCOPE_LIMIT && columnFile(caller)) scope.add(caller);
        addImports(caller, 1);
      }
    }
  }
  const truncated = scope.size >= SCOPE_LIMIT;
  for (const p of scope) attached.add(p);

  // Features: hits in this file go to the nearest anchor before them;
  // hits in the other files of the scope belong to every usage that reaches them.
  const position = anchors.indexOf(anchor);
  const from = position === 0 ? 0 : anchor.index;
  const to = anchors[position + 1]?.index ?? Infinity;
  const features = [];
  for (const feature of library.features) {
    const at = [];
    let evidence;
    for (const path of scope) {
      const f = fileOf(path);
      const global = new RegExp(
        feature.re.source,
        feature.re.flags.includes('g') ? feature.re.flags : `${feature.re.flags}g`,
      );
      for (const m of withoutImports(f).matchAll(global)) {
        const index = m.index ?? 0;
        if (path === file.path && (index < from || index >= to)) continue;
        const where = `${f.rel}:${String(f.line(index))}`;
        if (at.length < 3 && !at.includes(where)) at.push(where);
        evidence ??= m[0].replace(/\s+/g, ' ').slice(0, 80);
      }
    }
    if (!at.length) continue;
    const ref = feature.fit === 'gap' ? `gaps.md#${feature.gap}` : `${library.reference}`;
    features.push({
      id: feature.id,
      fit: feature.fit,
      argus: describeArgus(feature.argus),
      at,
      evidence,
      ref,
      ...(feature.gap ? { gap: feature.gap } : {}),
    });
  }
  if (library.sortsByDefault && !features.some((f) => f.id === 'sorting' || f.id === 'sort')) {
    features.unshift({
      id: 'sorting',
      fit: 'maps',
      argus: 'ColumnDef.sortable',
      at: [`${file.rel}:${String(file.line(anchor.index))}`],
      evidence: `${library.name} sorts every column by default; argus-table sorts only columns with sortable: true`,
      ref: library.reference,
    });
  }

  const counts = { maps: 0, partial: 0, builtin: 0, gap: 0 };
  for (const feature of features) counts[feature.fit]++;
  const gaps = [...new Set(features.filter((f) => f.fit === 'gap').map((f) => f.gap))];
  const hardGaps = gaps.filter((g) => HARD_GAPS.includes(g));
  const columnsApprox = [...scope].reduce(
    (n, p) => n + countMatches(library.columnKey, fileOf(p).text),
    0,
  );
  const effort =
    hardGaps.length || gaps.length >= 3
      ? 'high'
      : gaps.length || counts.partial > 1 || columnsApprox > 15
        ? 'medium'
        : 'low';
  return {
    id: '',
    path: file.path,
    library: library.id,
    project: rel(ctx.scanRoot, file.project) || '.',
    file: file.rel,
    line: file.line(anchor.index),
    anchor: anchor.text,
    framework: frameworkOfFile(file),
    clientDirective: /^\s*['"]use client['"]/.test(file.text),
    kind,
    scope: {
      files: [...scope].filter((p) => p !== file.path).map((p) => fileOf(p).rel),
      callSites,
      truncated,
    },
    columnsApprox,
    features,
    summary: { ...counts, effort, gaps: GAPS.filter((g) => gaps.includes(g)), hardGaps },
  };
}

/** The local scripts an HTML page loads (`<script src>`), as paths. */
function pageScripts(file, scanRoot) {
  const found = [];
  for (const m of file.text.matchAll(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi)) {
    const src = m[1];
    if (/^(?:[a-z]+:)?\/\//i.test(src)) continue;
    const base = src.startsWith('/') ? file.project : dirname(file.path);
    const path = src.startsWith('/') ? join(base, src) : resolve(base, src);
    if (read(path) !== undefined) found.push(path);
    else if (src.startsWith('/') && read(join(scanRoot, src)) !== undefined)
      found.push(join(scanRoot, src));
  }
  return found;
}

/** The file's text with import statements blanked out (same offsets): names in imports aren't usage. */
function withoutImports(file) {
  file.code ??= file.text.replace(
    /^\s*import\s[^;]*?from\s*['"][^'"]+['"];?|^\s*import\s*['"][^'"]+['"];?/gm,
    (m) => m.replace(/[^\n]/g, ' '),
  );
  return file.code;
}

function frameworkOfFile(file) {
  if (file.ext === '.vue') return 'vue';
  if (file.ext === '.svelte') return 'svelte';
  if (/@angular\/core|@Component\s*\(/.test(file.text)) return 'angular';
  if (/\.[jt]sx$/.test(file.ext) || /from\s+['"]react['"]/.test(file.text)) return 'react';
  if (/from\s+['"]vue['"]/.test(file.text)) return 'vue';
  return file.ext === '.html' ? 'html' : 'vanilla';
}

function countMatches(re, text) {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  return [...text.matchAll(global)].length;
}

function argusUsages(paths, fileOf) {
  const found = [];
  for (const path of paths) {
    const file = fileOf(path);
    if (!/argus-table|ArgusTable/.test(file.text)) continue;
    const patterns = [
      [/<ArgusTable\b/g, 'wrapper'],
      [/<argus-table\b/g, 'element'],
      [/cdn\.jsdelivr\.net\/npm\/argus-table|unpkg\.com\/argus-table/g, 'cdn'],
      [
        new RegExp(
          `from\\s+['"](?:${PACKAGES.map((p) => p.replace(/[/]/g, '\\/')).join('|')})['"]|import\\s+['"]argus-table['"]`,
          'g',
        ),
        'import',
      ],
    ];
    for (const [re, kind] of patterns) {
      for (const m of file.text.matchAll(re))
        found.push({ file: file.rel, line: file.line(m.index ?? 0), kind });
    }
  }
  return found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

/** Whether a script refers to the table, or its body, by id or class. */
function referenced(tableText, scripts) {
  for (const m of tableText.matchAll(
    /<(?:table|tbody)\b[^>]*\b(id|class)\s*=\s*['"]([^'"]+)['"]/gi,
  )) {
    for (const name of m[2].split(/\s+/)) {
      const token = m[1].toLowerCase() === 'id' ? `#${name}` : `.${name}`;
      if (scripts.includes(token) || scripts.includes(`'${name}'`) || scripts.includes(`"${name}"`))
        return true;
    }
  }
  return false;
}

/** A short text digest of the report. */
export function summarize(report) {
  const lines = [];
  lines.push(
    `Package manager: ${report.packageManager.name}${report.packageManager.lockfile ? ` (${report.packageManager.lockfile})` : ''}`,
  );
  if (report.monorepo.workspaces.length)
    lines.push(
      `Workspaces (${report.monorepo.tool ?? 'workspaces'}): ${report.monorepo.workspaces.map((w) => w.path).join(', ')}`,
    );
  for (const p of report.projects) {
    const fw = `${p.framework.name}${p.framework.version ? ` ${p.framework.version}` : ''}${p.framework.supported ? '' : ' (not supported by the wrapper)'}`;
    const meta = p.meta.name
      ? `, ${p.meta.name}${p.meta.rsc ? ' (React Server Components)' : p.meta.ssr ? ' (SSR)' : ''}`
      : '';
    lines.push(
      `\nProject ${p.path}${p.name ? ` (${p.name})` : ''}: ${fw}${meta}${p.typescript.present ? ', TypeScript' : ''}`,
    );
    const argus = Object.entries(p.argus.packages).map(([n, v]) => `${n}@${v.version ?? v.range}`);
    lines.push(
      `  argus-table: ${argus.length ? argus.join(', ') : 'not installed'}${p.argus.mismatched.length ? '  ! versions differ' : ''}${p.argus.belowMinimum ? `  ! below ${p.argus.minimum}` : ''}`,
    );
    if (p.argus.themes.length) lines.push(`  themes: ${p.argus.themes.join(', ')}`);
    if (p.tableLibraries.length)
      lines.push(
        `  table libraries: ${p.tableLibraries.map((l) => `${l.id} ${l.version ?? Object.values(l.packages)[0]}${l.edition ? ` (${l.edition})` : ''}`).join(', ')}`,
      );
    for (const l of p.tableLibraries)
      for (const note of l.notes ?? []) lines.push(`  note: ${note}`);
    if (p.themeTargets.length) lines.push(`  theme import goes in: ${p.themeTargets[0]}`);
  }
  if (report.usages.length) {
    lines.push(`\nTable usages (${String(report.usages.length)}):`);
    for (const u of report.usages) {
      const s = u.summary;
      lines.push(
        `  ${u.id} ${u.file}:${String(u.line)} ${u.library}${u.kind === 'shared-component' ? ` (shared component, used in ${String(u.scope.callSites.length)} files)` : ''}, ~${String(u.columnsApprox)} columns, effort ${s.effort}`,
      );
      lines.push(
        `     ${String(s.maps)} map, ${String(s.partial)} partial, ${String(s.builtin)} built in, ${String(s.gap)} gaps${s.gaps.length ? `: ${s.gaps.join(', ')}` : ''}`,
      );
    }
  } else {
    lines.push('\nNo table usages found.');
  }
  if (report.orphanColumnFiles.length)
    lines.push(
      `\nColumn definitions not reached from a usage: ${report.orphanColumnFiles.map((o) => o.file).join(', ')}`,
    );
  if (report.argusUsages.length)
    lines.push(
      `\nargus-table already used in: ${[...new Set(report.argusUsages.map((a) => a.file))].join(', ')}`,
    );
  for (const w of report.warnings) lines.push(`\nWarning: ${w}`);
  return lines.join('\n');
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (
    !read(join(resolve(options.dir), 'package.json')) &&
    !walk(resolve(options.dir), { maxFiles: 1 }).files.length
  ) {
    console.error(
      `Nothing to scan in ${resolve(options.dir)}: no package.json and no source files.`,
    );
    return 1;
  }
  const report = scan(options);
  console.log(options.summary ? summarize(report) : JSON.stringify(report, null, 2));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
