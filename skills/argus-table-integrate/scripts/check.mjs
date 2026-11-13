#!/usr/bin/env node
// Checks a project's argus-table integration without running it: package
// versions, the wrapper, the theme, and each table's bindings, columns,
// plugins and events. Static and heuristic: read every finding as a lead,
// and suppress a wrong one with a comment:
//   // argus-check-ignore <rule-id>             (on the line)
//   // argus-check-ignore-next-line <rule-id>   (on the line before)
//
//   node check.mjs [dir] [--scan scan.json] [--from <library>] [--only ids]
//                  [--ignore ids] [--strict] [--json]
//
// Exit code 1 when there are errors (or warnings, with --strict), 2 for bad
// arguments. Read-only: no network, nothing written.
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADDONS,
  ADDON_EVENTS,
  COLUMN_FIELDS,
  COLUMN_FIELD_RENAMES,
  CONTROLLABLES,
  EVENTS,
  INTERNAL_PROPERTIES,
  MIN_VERSION,
  PACKAGES,
  PLUGIN_ORDER,
  PROPERTIES,
  RENAMED_EVENTS,
  SINCE,
  WRAPPERS,
  bare,
  camel,
  compareVersions,
  eventBindings,
  kebab,
} from './lib/api.mjs';
import { LIBRARIES } from './lib/libraries.mjs';
import {
  argusPackages,
  dependencies,
  detectFramework,
  findRoot,
  projectOf,
  projects,
} from './lib/project.mjs';
import {
  arrayAt,
  enclosingArray,
  findDeclaration,
  findTags,
  objectKeys,
  objectValue,
  objectsInArray,
} from './lib/markup.mjs';
import {
  makeResolver,
  MARKUP_EXTS,
  SCRIPT_EXTS,
  STYLE_EXTS,
  importsOf,
  lineIndex,
  read,
  readJson,
  rel,
  stripComments,
  walk,
} from './lib/walk.mjs';

/** Every rule, with its default severity. references/pitfalls.md has a section per id. */
export const RULES = {
  'versions-mixed': 'error',
  'duplicate-argus-table': 'error',
  'version-below-minimum': 'warn',
  'feature-needs-newer-version': 'error',
  'framework-peer': 'error',
  'wrapper-mismatch': 'error',
  'raw-element': 'warn',
  'attribute-for-property': 'error',
  'no-theme': 'warn',
  'multiple-themes': 'warn',
  'missing-label': 'warn',
  'unstable-identity': 'warn',
  'selection-without-row-id': 'warn',
  'datasource-without-row-id': 'info',
  'plugin-order': 'error',
  'addon-not-installed': 'error',
  'addon-not-registered': 'warn',
  'addon-unused': 'info',
  'server-component-props': 'error',
  'controlled-without-handler': 'warn',
  'sortable-never-set': 'info',
  'leftover-library': 'warn',
  'unused-dependency': 'info',
  'unknown-prop': 'warn',
  'unknown-event': 'error',
  'unknown-column-field': 'warn',
  'data-mutated': 'warn',
  'set-filter-needs-options': 'warn',
  'cdn-and-bundle': 'error',
};

const USAGE = `Usage: node check.mjs [dir] [--scan scan.json] [--from <library>] [--only ids] [--ignore ids] [--strict] [--json]

Rules: ${Object.keys(RULES).join(', ')}
Libraries for --from: ${LIBRARIES.map((l) => l.id).join(', ')}`;

const DOM_EVENTS = [
  'click',
  'dblclick',
  'contextmenu',
  'auxclick',
  'keydown',
  'keyup',
  'keypress',
  'focus',
  'blur',
  'focusin',
  'focusout',
  'input',
  'change',
  'submit',
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointerenter',
  'pointerleave',
  'pointerover',
  'pointerout',
  'pointercancel',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseenter',
  'mouseleave',
  'mouseover',
  'mouseout',
  'wheel',
  'scroll',
  'scrollend',
  'touchstart',
  'touchend',
  'touchmove',
  'touchcancel',
  'copy',
  'paste',
  'cut',
  'drag',
  'dragstart',
  'dragend',
  'dragenter',
  'dragleave',
  'dragover',
  'drop',
  'animationstart',
  'animationend',
  'transitionend',
  'resize',
  'load',
  'error',
  'gotpointercapture',
  'lostpointercapture',
];
const REACT_DOM_EVENTS = new Set(
  DOM_EVENTS.flatMap((e) => {
    const name = `on${e[0].toUpperCase()}${e.slice(1)}`
      .replace('Dblclick', 'DoubleClick')
      .replace('Contextmenu', 'ContextMenu')
      .replace(
        /(Key|Pointer|Mouse|Touch|Focus|Drag|Animation|Transition|Scroll|Aux)(\w)/,
        (_, a, b) => a + b.toUpperCase(),
      );
    return [name, `${name}Capture`];
  }),
);
const ALLOWED_ATTRS =
  /^(?:aria-[\w-]+|data-[\w-]+|id|class|className|style|key|ref|slot|title|role|tabIndex|tabindex|hidden|part|children|dir|lang|is|inert|exportparts|suppressHydrationWarning|attr\.[\w-]+|class\.[\w-]+|style\.[\w.-]+|ngClass|ngStyle|ngIf|ngFor|ngModel|v-[\w:-]+|#[\w-]+|\*[\w]+|bind:this|this)$/;
/** Props other grids use, and what they are on argus-table. */
const PROP_RENAMES = {
  rowData: 'data',
  rows: 'data',
  items: 'data',
  dataSource: 'dataSource (a { getRows } object, not an array)',
  value: 'data',
  columnDefs: 'columns',
  headers: 'columns',
  getRowNodeId: 'getRowId',
  rowKey: 'getRowId',
  dataKey: 'getRowId',
  itemValue: 'getRowId',
  rowSelection: 'selectionMode and selection',
  checkboxSelection: 'selectionCheckboxes',
  rowSelectionModel: 'selection',
  sortModel: 'sorting',
  filterModel: 'columnFilters',
  columnVisibilityModel: 'columnVisibility',
  quickFilterText: 'quickFilter',
  search: 'quickFilter',
  globalFilter: 'quickFilter',
  pinnedTopRowData: 'pinnedRows',
  pinnedBottomRowData: 'pinnedRows',
  localeText: 'labels',
  locale: 'labels',

  pageSize: 'dataSource.pageSize',
};

/** Props of other grids with no equivalent, and why. */
const PROP_GONE = {
  loading: 'rows from a dataSource show as skeletons while they load',
  pagination: 'the table scrolls instead of paging (references/gaps.md#pagination)',
  paginationModel: 'the table scrolls instead of paging (references/gaps.md#pagination)',
  paginationMode: 'a dataSource loads pages as they scroll into view',
  pageSizeOptions: 'the table scrolls instead of paging (references/gaps.md#pagination)',
  rowCount: "a dataSource's getRows returns the total",
};

/** Parses the command line; throws a usage error. */
export function parseArgs(args) {
  const options = {
    dir: '.',
    scan: undefined,
    from: [],
    only: undefined,
    ignore: [],
    strict: false,
    json: false,
  };
  const ids = (text) => {
    const list = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = list.filter((id) => !(id in RULES));
    if (unknown.length) throw new Error(`Unknown rule "${unknown[0]}".`);
    return list;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => {
      const v = args[++i];
      if (v === undefined) throw new Error(`${a} needs a value.`);
      return v;
    };
    if (a === '--scan') options.scan = value();
    else if (a === '--from') {
      const id = value();
      if (!LIBRARIES.some((l) => l.id === id)) throw new Error(`Unknown library "${id}".`);
      options.from.push(id);
    } else if (a === '--only') options.only = ids(value());
    else if (a === '--ignore') options.ignore.push(...ids(value()));
    else if (a === '--strict') options.strict = true;
    else if (a === '--json') options.json = true;
    else if (a.startsWith('-')) throw new Error(`Unknown option ${a}.`);
    else options.dir = a;
  }
  return options;
}

/** Runs every check on `options.dir`; returns the findings. */
export function check(options) {
  const root = resolve(options.dir);
  const repoRoot = findRoot(root);
  const projectDirs = projects(root);
  const walked = walk(root, { maxFiles: 20000 });
  const findings = [];
  const files = new Map();
  const fileOf = (path) => {
    let file = files.get(path);
    if (!file) {
      const raw = read(path) ?? '';
      file = {
        path,
        rel: rel(root, path),
        raw,
        text: stripComments(raw, path),
        ext: extname(path).toLowerCase(),
        project: projectOf(path, projectDirs) ?? root,
        line: lineIndex(raw),
        lines: raw.split('\n'),
      };
      files.set(path, file);
    }
    return file;
  };
  const report = (rule, file, index, message, fix, severity = RULES[rule]) => {
    findings.push({
      rule,
      severity,
      file: typeof file === 'string' ? file : file?.rel,
      line:
        typeof index === 'number' && file && typeof file !== 'string' ? file.line(index) : index,
      message,
      fix,
    });
  };

  let scanReport;
  if (options.scan) {
    scanReport = readJson(resolve(options.scan));
    if (!scanReport?.usages) throw new Error(`${options.scan} is not a scan.mjs report.`);
  }
  const fromLibraries = new Set([
    ...options.from,
    ...(scanReport?.usages ?? []).map((u) => u.library),
  ]);

  const sourcePaths = walked.files.filter(
    (p) => SCRIPT_EXTS.has(extname(p).toLowerCase()) || MARKUP_EXTS.has(extname(p).toLowerCase()),
  );
  const stylePaths = walked.files.filter((p) => STYLE_EXTS.has(extname(p).toLowerCase()));
  const templateOwner = new Map();
  for (const path of sourcePaths) {
    const file = fileOf(path);
    for (const m of file.text.matchAll(/\btemplateUrl\s*:\s*['"]([^'"]+)['"]/g))
      templateOwner.set(resolve(dirname(path), m[1]), path);
  }

  for (const dir of projectDirs) {
    const projectFiles = sourcePaths.filter((p) => projectOf(p, projectDirs) === dir).map(fileOf);
    const projectStyles = stylePaths.filter((p) => projectOf(p, projectDirs) === dir).map(fileOf);
    const usesArgus = projectFiles.some((f) =>
      /argus-table|ArgusTable|@argus-table\//.test(f.text),
    );
    const pkgPath = join(dir, 'package.json');
    const pkg = readJson(pkgPath) ?? {};
    const pkgFile = existsSync(pkgPath) ? fileOf(pkgPath) : undefined;
    const pkgLine = (name) => {
      if (!pkgFile) return undefined;
      const i = pkgFile.raw.indexOf(`"${name}"`);
      return i === -1 ? undefined : pkgFile.line(i);
    };
    const deps = {
      ...dependencies(readJson(join(repoRoot, 'package.json'))),
      ...dependencies(pkg),
    };
    const argus = argusPackages(dir, repoRoot);
    const framework = detectFramework(dir, repoRoot);
    const pkgRel = pkgFile?.rel ?? rel(root, pkgPath);
    if (!usesArgus && !Object.keys(argus.packages).length) continue;

    // --- Packages and versions ---
    if (argus.mismatched.length) {
      const exact = Object.values(argus.packages).filter((p) => p.version);
      const severity = new Set(exact.map((p) => p.version)).size > 1 ? 'error' : 'warn';
      findings.push({
        rule: 'versions-mixed',
        severity,
        file: pkgRel,
        line: pkgLine(Object.keys(argus.packages)[0]),
        message: `argus-table packages are at different versions: ${argus.mismatched.join(', ')}. They are released together and must match.`,
        fix: 'Install every argus-table package at the same version (setup.mjs prints the command).',
      });
    }
    if (argus.duplicates.length) {
      report(
        'duplicate-argus-table',
        pkgRel,
        pkgLine('argus-table'),
        `More than one copy of argus-table is installed (${argus.duplicates.join(', ')}): the second registration throws "argus-table has already been defined".`,
        'Align the versions of argus-table and its wrapper and add-ons, reinstall, and dedupe (npm dedupe / pnpm dedupe).',
      );
    }
    if (argus.belowMinimum) {
      report(
        'version-below-minimum',
        pkgRel,
        pkgLine('argus-table') ?? pkgLine(Object.keys(argus.packages)[0]),
        `argus-table ${String(argus.version)} is older than ${MIN_VERSION}, the release these references describe.`,
        `Upgrade every argus-table package together to ${MIN_VERSION} or later.`,
      );
    }
    if (argus.version) {
      for (const since of SINCE) {
        if (compareVersions(argus.version, since.version) >= 0) continue;
        for (const file of projectFiles) {
          const m = since.patterns.map((re) => re.exec(file.text)).find(Boolean);
          if (m) {
            report(
              'feature-needs-newer-version',
              file,
              m.index,
              `${since.feature} needs argus-table ${since.version}; the project has ${String(argus.version)}.`,
              `Upgrade every argus-table package together to ${since.version} or later.`,
            );
            break;
          }
        }
      }
    }
    const wrapper = Object.keys(argus.packages).find((p) => Object.values(WRAPPERS).includes(p));
    if (wrapper) {
      const fwOfWrapper = Object.keys(WRAPPERS).find((k) => WRAPPERS[k] === wrapper);
      if (framework.name in WRAPPERS && fwOfWrapper !== framework.name) {
        report(
          'wrapper-mismatch',
          pkgRel,
          pkgLine(wrapper),
          `${wrapper} is the wrapper for ${String(fwOfWrapper)}, but this is a ${framework.name} project.`,
          `Use ${WRAPPERS[framework.name]} instead.`,
        );
      } else if (fwOfWrapper === framework.name && !framework.supported) {
        report(
          'framework-peer',
          pkgRel,
          pkgLine(framework.package ?? ''),
          `${wrapper} needs ${String(framework.package)} ${framework.name === 'react' ? '18.3 or 19' : framework.name === 'vue' ? '3.5 or later' : '20, 21 or 22'}; the project has ${String(framework.version)}.`,
          `Upgrade ${String(framework.package)}, or use the <argus-table> element directly.`,
        );
      }
    }

    // --- Imports of argus packages: installed? used? ---
    const imported = new Map();
    for (const file of [...projectFiles, ...projectStyles]) {
      for (const { spec, index } of importsOf(file.text)) {
        const name = PACKAGES.find((p) => spec === p || spec.startsWith(`${p}/`));
        if (!name) continue;
        if (!imported.has(name)) imported.set(name, []);
        imported.get(name).push({ file, index });
      }
    }
    for (const [name, sites] of imported) {
      if (name in deps) continue;
      const { file, index } = sites[0];
      if (name === 'argus-table' && wrapper) {
        findings.push({
          rule: 'addon-not-installed',
          severity: 'warn',
          file: file.rel,
          line: file.line(index),
          message: `argus-table is imported here but isn't a dependency: it comes with ${wrapper}, which breaks under strict installs (pnpm, Yarn PnP).`,
          fix: `Add argus-table at the same version as ${wrapper}.`,
        });
      } else {
        report(
          'addon-not-installed',
          file,
          index,
          `${name} is imported but isn't a dependency of ${pkgRel}.`,
          `Install it at the same version as the other argus-table packages.`,
        );
      }
    }
    for (const [addon, info] of Object.entries(ADDONS)) {
      const sites = imported.get(addon);
      if (addon in deps && !sites) {
        report(
          'addon-unused',
          pkgRel,
          pkgLine(addon),
          `${addon} is installed but never imported.`,
          "Remove it, or add it to the table's plugins.",
        );
      }
      if (sites) {
        const called = projectFiles.some((f) =>
          new RegExp(`\\b${info.factory}\\s*(?:<[^>]*>)?\\s*\\(`).test(
            f.text.replace(/import[^;]*;/g, ''),
          ),
        );
        if (!called) {
          const { file, index } = sites[0];
          report(
            'addon-not-registered',
            file,
            index,
            `${addon} is imported, but ${info.factory}() is never called: the add-on does nothing until it's in plugins.`,
            `plugins = [${info.factory}()] (defined once, not per render).`,
          );
        }
      }
    }
    if (
      '@argus-table/themes' in deps &&
      !imported.has('@argus-table/themes') &&
      !projectHasTheme(dir, projectFiles, projectStyles)
    ) {
      report(
        'addon-unused',
        pkgRel,
        pkgLine('@argus-table/themes'),
        '@argus-table/themes is installed but no theme file is loaded.',
        "Import one theme: import '@argus-table/themes/default.css'.",
      );
    }

    // --- Theme ---
    if (usesArgus) {
      const themes = themesIn(dir, projectFiles, projectStyles);
      const custom = projectStyles.some((f) => /argus-table[^{]*\{[^}]*--argus-/.test(f.text));
      if (!themes.size && !custom) {
        const first = projectFiles.find((f) => /argus-table|ArgusTable/.test(f.text));
        report(
          'no-theme',
          first ?? pkgRel,
          first ? first.text.search(/argus-table|ArgusTable/) : undefined,
          'No argus-table theme is loaded: the table renders with neutral system colours.',
          "Import one theme where global CSS goes: import '@argus-table/themes/default.css' (setup.mjs says where).",
        );
      } else if (themes.size > 1) {
        report(
          'multiple-themes',
          pkgRel,
          undefined,
          `Several themes are loaded (${[...themes].join(', ')}): they set the same tokens, and the last one wins.`,
          'Load one theme per page; override single tokens with CSS instead.',
        );
      }
    }

    // --- CDN and bundle ---
    const cdn = projectFiles.find((f) =>
      /cdn\.jsdelivr\.net\/npm\/argus-table|unpkg\.com\/argus-table/.test(f.text),
    );
    const bundled = projectFiles.find(
      (f) =>
        SCRIPT_EXTS.has(f.ext) &&
        /from\s+['"](?:argus-table|@argus-table\/(?:react|vue|angular))['"]|import\s+['"]argus-table['"]/.test(
          f.text,
        ),
    );
    if (cdn && bundled) {
      report(
        'cdn-and-bundle',
        cdn,
        cdn.text.search(/cdn\.jsdelivr\.net\/npm\/argus-table|unpkg\.com\/argus-table/),
        `The page loads argus-table from a CDN and ${bundled.rel} bundles it too: the second copy throws "argus-table has already been defined".`,
        'Use one: the npm packages with a bundler, or the CDN script.',
      );
    }

    // --- Plugin order ---
    for (const file of projectFiles) {
      const calls = [];
      for (const factory of PLUGIN_ORDER) {
        const addon = Object.keys(ADDONS).find((a) => ADDONS[a].factory === factory);
        if (!file.text.includes(addon ?? '') && !file.text.includes(factory)) continue;
        if (
          !new RegExp(
            `['"]${String(addon).replace('/', '\\/')}(?:@[^'"/]*)?(?:\\/\\+esm)?['"]|${String(addon).replace('/', '\\/')}`,
          ).test(file.text)
        )
          continue;
        for (const m of file.text.matchAll(
          new RegExp(`\\b${factory}\\s*(?:<[^>]*>)?\\s*\\(`, 'g'),
        )) {
          const open = enclosingArray(file.text, m.index ?? 0);
          if (open !== -1) calls.push({ factory, open, index: m.index ?? 0 });
        }
      }
      const byArray = new Map();
      for (const c of calls) byArray.set(c.open, [...(byArray.get(c.open) ?? []), c]);
      for (const [open, list] of byArray) {
        if (list.length < 2) continue;
        list.sort((a, b) => a.index - b.index);
        const ranks = list.map((c) => PLUGIN_ORDER.indexOf(c.factory));
        if (ranks.some((r, i) => i > 0 && r < ranks[i - 1])) {
          report(
            'plugin-order',
            file,
            open,
            `Plugins in the wrong order: [${list.map((c) => `${c.factory}()`).join(', ')}].`,
            `Order them [${PLUGIN_ORDER.filter((p) => list.some((c) => c.factory === p))
              .map((p) => `${p}()`)
              .join(
                ', ',
              )}]: tableExport() reads text headers before formulas() and headerMenu() wrap them, and formulas() names columns before the menu does.`,
          );
        }
      }
    }

    // --- Tables ---
    const resolver = makeResolver(dir);
    const trace = (file, value) => traceArray(file, value, { resolver, fileOf });
    const vanilla = vanillaBindings(projectFiles, trace);
    const tables = [];
    for (const file of projectFiles) {
      for (const name of ['ArgusTable', 'argus-table']) {
        for (const tag of findTags(file.text, name)) {
          tables.push({
            file,
            tag,
            framework: tableFramework(file, name, framework, templateOwner),
          });
        }
      }
    }
    for (const t of tables)
      checkTable(t, {
        report,
        findings,
        framework,
        fromLibraries,
        vanilla,
        fileOf,
        templateOwner,
        projectFiles,
        trace,
      });
    // Vanilla tables: bindings made in scripts, checked once per project.
    if (vanilla.files.length) checkVanilla(vanilla, tables, { report, fromLibraries });

    // --- Next.js Server Components ---
    if (framework.meta.rsc) {
      for (const t of tables) {
        if (t.framework !== 'react') continue;
        const relPath = t.file.rel;
        const inApp =
          new RegExp(`(?:^|/)${String(framework.meta.appDir).replace('/', '\\/')}/`).test(
            rel(dir, t.file.path),
          ) || rel(dir, t.file.path).startsWith(`${String(framework.meta.appDir)}/`);
        if (!inApp || /^\s*['"]use client['"]/.test(t.file.text)) continue;
        const reasons = [];
        for (const a of t.tag.attrs) {
          if (a.kind === 'event') reasons.push(a.name);
          else if (['plugins', 'getRowId', 'dataSource'].includes(a.name)) reasons.push(a.name);
          else if (a.name === 'columns' && a.value) {
            const cols = trace(t.file, a.value);
            if (cols && /=>|\bfunction\b|\bcell\s*:/.test(cols.text))
              reasons.push('columns with functions');
          }
        }
        if (!reasons.length) continue;
        const special = /(?:^|\/)(?:page|layout|template|default|not-found)\.[jt]sx?$/.test(
          relPath,
        );
        findings.push({
          rule: 'server-component-props',
          severity: special ? 'error' : 'warn',
          file: relPath,
          line: t.file.line(t.tag.start),
          message: `This Server Component passes ${reasons.join(', ')} to <ArgusTable>: functions can't cross to a Client Component${special ? '' : ' (fine if only Client Components import this file)'}.`,
          fix: "Move the table into a file that starts with 'use client', and pass it only data from the server.",
        });
      }
    }

    // --- Old libraries ---
    const catalogDeps = LIBRARIES.flatMap((l) => l.deps.map((d) => ({ dep: d, library: l })));
    const usageFiles = new Set(
      (scanReport?.usages ?? []).flatMap((u) => [u.file, ...u.scope.files, ...u.scope.callSites]),
    );
    for (const file of projectFiles) {
      const argusFile = /argus-table|ArgusTable|@argus-table\//.test(file.text);
      if (!argusFile && !usageFiles.has(file.rel)) continue;
      for (const { spec, index } of importsOf(file.text)) {
        const hit = catalogDeps.find(({ dep }) => spec === dep || spec.startsWith(`${dep}/`));
        if (hit && !(hit.library.id === 'angular-material' && !/table|sort|paginator/.test(spec))) {
          report(
            'leftover-library',
            file,
            index,
            `${file.rel} still imports ${spec} (${hit.library.name})${argusFile ? ' next to argus-table' : ''}.`,
            'Finish moving this table, then remove the import and its CSS.',
          );
        }
      }
      const css =
        /['"][^'"]*(?:ag-grid\.css|ag-theme-[\w-]+\.css|@mui\/x-data-grid[^'"]*\.css)['"]/.exec(
          file.text,
        );
      if (css && argusFile)
        report(
          'leftover-library',
          file,
          css.index,
          `${file.rel} still loads the old grid's CSS.`,
          'Remove it once no table uses it.',
        );
    }
    for (const { dep, library } of catalogDeps) {
      if (!(dep in dependencies(pkg))) continue;
      if (library.id === 'angular-material' || dep === '@angular/cdk') continue;
      const used =
        projectFiles.some((f) => f.text.includes(`'${dep}`) || f.text.includes(`"${dep}`)) ||
        projectStyles.some((f) => f.text.includes(dep));
      if (!used)
        report(
          'unused-dependency',
          pkgRel,
          pkgLine(dep),
          `${dep} (${library.name}) is a dependency but nothing imports it any more.`,
          `Remove it (${pmRemove(repoRoot)} ${dep}) if no other code needs it.`,
        );
    }
  }

  return filterFindings(findings, options, fileOf, root);
}

/** The framework a table tag is written in. */
function tableFramework(file, name, framework, templateOwner) {
  if (file.ext === '.vue') return 'vue';
  if (file.ext === '.svelte') return 'svelte';
  if (file.ext === '.astro') return 'vanilla';
  if (file.ext === '.html' || file.ext === '.htm') {
    return framework.name === 'angular' && templateOwner.has(file.path) ? 'angular' : 'vanilla';
  }
  if (framework.name === 'angular' && /@Component\s*\(/.test(file.text)) return 'angular';
  if (/\.[jt]sx$/.test(file.ext)) return framework.name === 'solid' ? 'solid' : 'react';
  if (name === 'ArgusTable' && framework.name === 'react') return 'react';
  if (/\bh\s*\(\s*ArgusTable|from\s+['"]vue['"]/.test(file.text)) return 'vue';
  if (
    framework.name === 'react' &&
    /from\s+['"]react['"]/.test(file.text) &&
    !/\bhtml`/.test(file.text)
  )
    return 'react';
  return 'vanilla';
}

/** A binding's property name: `get-row-id` → `getRowId`. */
function propName(attr, fw) {
  if (fw === 'angular' || fw === 'react' || fw === 'solid') return attr.name.replace(/^prop:/, '');
  // `data-*` and `aria-*` stay attributes; a bound `:data-source` is the dataSource property.
  if (attr.name.startsWith('aria-') || (attr.kind === 'static' && attr.name.startsWith('data-')))
    return attr.name;
  return attr.name.includes('-') ? camel(attr.name) : attr.name;
}

function checkTable(t, ctx) {
  const { report, findings, fromLibraries, vanilla } = ctx;
  const { file, tag } = t;
  const fw = t.framework;
  const at = tag.start;
  const attrs = tag.attrs.map((a) => ({ ...a, prop: propName(a, fw) }));
  const spread = attrs.some((a) => a.kind === 'spread');
  const bound = (prop) =>
    attrs.find(
      (a) => a.prop === prop && (a.kind === 'bound' || a.kind === 'twoWay' || a.kind === 'static'),
    );
  const has = (prop) =>
    attrs.some((a) => a.prop === prop) || (fw === 'vanilla' && vanilla.props.has(prop));

  // raw-element
  if (tag.name === 'argus-table' && (fw === 'react' || fw === 'vue')) {
    const major = Number(String(ctx.framework.version ?? '').split('.')[0]);
    const severity = fw === 'react' && major && major < 19 ? 'error' : 'warn';
    findings.push({
      rule: 'raw-element',
      severity,
      file: file.rel,
      line: file.line(at),
      message: `A raw <argus-table> in ${fw === 'react' ? 'JSX' : 'a Vue template'}: ${fw === 'react' && severity === 'error' ? 'React 18 sets every prop as a string attribute, so columns and data never arrive' : 'no typed props, no framework content in cells, and events need manual listeners'}.`,
      fix: `Use <ArgusTable> from ${WRAPPERS[fw]}.`,
    });
  }
  if (tag.name === 'argus-table' && fw === 'angular') {
    const owner = ctx.templateOwner.get(file.path);
    const component = owner ? ctx.fileOf(owner).text : file.text;
    const imported =
      /\b(?:ARGUS_TABLE|ArgusTableComponent)\b/.test(component) ||
      ctx.projectFiles.some(
        (f) =>
          /@NgModule\s*\(/.test(f.text) && /\b(?:ARGUS_TABLE|ArgusTableComponent)\b/.test(f.text),
      );
    if (!imported) {
      findings.push({
        rule: 'raw-element',
        severity: 'warn',
        file: file.rel,
        line: file.line(at),
        message:
          '<argus-table> in an Angular template without the wrapper: no typed inputs, no [(two-way)] state, no argusCell templates.',
        fix: "Add ARGUS_TABLE from @argus-table/angular to the component's imports, and drop CUSTOM_ELEMENTS_SCHEMA.",
      });
    }
  }

  // attribute-for-property
  for (const a of attrs) {
    if (a.kind !== 'static' || a.value === undefined) continue;
    if (a.prop in PROPERTIES && PROPERTIES[a.prop] === null) {
      report(
        'attribute-for-property',
        file,
        a.index,
        `${a.name}="…" is an attribute: ${a.prop} takes ${a.prop === 'getRowId' ? 'a function' : 'an object or array'}, which only a property can hold.`,
        fw === 'vue'
          ? `:${a.name}="…"`
          : fw === 'angular'
            ? `[${a.prop}]="…"`
            : fw === 'react'
              ? `${a.prop}={…}`
              : `table.${a.prop} = … in a script`,
      );
    }
  }

  // missing-label (also aria-labelledby pointing at nothing)
  const labelledby = attrs.find((a) => a.name === 'aria-labelledby' && a.kind === 'static');
  if (
    labelledby?.value &&
    !labelledby.value
      .split(/\s+/)
      .every((id) =>
        ctx.projectFiles.some((f) =>
          new RegExp(`\\bid\\s*[=:]\\s*['"]${id.replace(/[^\w-]/g, '')}['"]`).test(f.text),
        ),
      )
  ) {
    report(
      'missing-label',
      file,
      labelledby.index,
      `aria-labelledby="${labelledby.value}" points at no element in the project: the table has no accessible name.`,
      'Give the heading that id, or use aria-label="…".',
    );
  }
  if (
    !spread &&
    !attrs.some(
      (a) =>
        /^(?:attr\.)?aria-label(?:ledby)?$/.test(a.name) || /^aria-?label(?:ledby)?$/i.test(a.prop),
    ) &&
    !(fw === 'vanilla' && vanilla.label)
  ) {
    report(
      'missing-label',
      file,
      at,
      'The table has no accessible name.',
      'Add aria-label="…" (or aria-labelledby pointing at a heading).',
    );
  }

  // unknown-prop and unknown-event
  const reactEvents = new Set([...EVENTS, ...ADDON_EVENTS].map((e) => eventBindings(e).react));
  const vueEvents = new Set(
    [...EVENTS, ...ADDON_EVENTS]
      .flatMap((e) => [bare(e), camel(bare(e))])
      .concat(CONTROLLABLES.map((p) => `update:${p}`)),
  );
  const angularEvents = new Set(
    [...EVENTS, ...ADDON_EVENTS].flatMap((e) => [eventBindings(e).angular, e]),
  );
  for (const a of attrs) {
    if (a.kind === 'event') {
      const name = a.name;
      let known;
      if (fw === 'react' || fw === 'solid')
        known =
          reactEvents.has(name) ||
          REACT_DOM_EVENTS.has(name) ||
          /^on(?:Key|Pointer|Mouse|Focus|Blur)/.test(name);
      else if (fw === 'vue') known = vueEvents.has(name) || DOM_EVENTS.includes(name);
      else
        known =
          angularEvents.has(name) ||
          DOM_EVENTS.includes(name) ||
          [...EVENTS, ...ADDON_EVENTS].includes(name);
      if (!known) {
        const old =
          RENAMED_EVENTS[name] ??
          RENAMED_EVENTS[`argus-${kebab(name.replace(/^on/, '')).replace(/^-/, '')}`];
        report(
          'unknown-event',
          file,
          a.index,
          `${name} is not an event of the table.`,
          old
            ? `It was renamed: ${fw === 'react' ? eventBindings(old).react : fw === 'vue' ? bare(old) : eventBindings(old).angular} (${old}).`
            : `The table's events: ${[...EVENTS].map((e) => (fw === 'react' ? eventBindings(e).react : fw === 'vue' ? bare(e) : eventBindings(e).angular)).join(', ')}.`,
        );
      }
      continue;
    }
    if (a.kind === 'spread' || a.kind === 'directive') continue;
    if (a.kind === 'twoWay' && CONTROLLABLES.includes(a.prop)) continue;
    const name = a.prop;
    if (
      name in PROPERTIES ||
      INTERNAL_PROPERTIES.includes(name) ||
      ALLOWED_ATTRS.test(a.name) ||
      ALLOWED_ATTRS.test(name)
    )
      continue;
    const attrNames = Object.values(PROPERTIES).filter(Boolean);
    if (attrNames.includes(a.name)) continue;
    if (fw === 'vue' && /^on[A-Z]/.test(name)) continue;
    if (PROP_GONE[name]) {
      report(
        'unknown-prop',
        file,
        a.index,
        `${a.name} has no equivalent: ${PROP_GONE[name]}.`,
        'Remove it.',
      );
      continue;
    }
    report(
      'unknown-prop',
      file,
      a.index,
      `${a.name} is not a property of the table${PROP_RENAMES[name] ? `: use ${PROP_RENAMES[name]}` : ''}.`,
      PROP_RENAMES[name]
        ? `Rename it, and check the value's shape in references/api.md.`
        : 'See references/api.md for the properties.',
    );
  }

  // unstable-identity
  for (const prop of ['columns', 'plugins', 'dataSource', 'columnGroups', 'pinnedRows']) {
    const a = bound(prop);
    if (!a || a.kind === 'static' || a.value === undefined) continue;
    const value = a.value.trim();
    if (/^[[{]/.test(value)) {
      report(
        'unstable-identity',
        file,
        a.index,
        `${prop} is written inline: every render makes a new ${prop === 'dataSource' ? 'object' : 'array'}${identityCost(prop)}.`,
        fw === 'react'
          ? `Define it at module scope or in useMemo, and pass the variable.`
          : fw === 'vue'
            ? 'Declare it once in <script setup> and bind the variable.'
            : 'Make it a readonly field of the component.',
      );
      continue;
    }
    const name = /^(?:this\.)?([A-Za-z_$][\w$]*)(?:\(\))?$/.exec(value)?.[1];
    if (!name) continue;
    const owner = fw === 'angular' ? (ctx.templateOwner.get(file.path) ?? file.path) : file.path;
    const ownerText = owner === file.path ? file.text : ctx.fileOf(owner).text;
    const getter = findDeclaration(ownerText, name);
    if (
      getter?.kind === 'getter' &&
      /^\s*(?:return\s*)?[[{]|\breturn\s*[[{]/.test(ownerText.slice(getter.init, getter.init + 200))
    ) {
      report(
        'unstable-identity',
        owner === file.path ? file : ctx.fileOf(owner),
        getter.index,
        `${name} is a getter that builds a new ${prop === 'dataSource' ? 'object' : 'array'} each time it's read${identityCost(prop)}.`,
        fw === 'angular'
          ? 'Make it a readonly field (or a computed() signal).'
          : 'Build it once, and keep it in a field.',
      );
      continue;
    }
    if (fw !== 'react' || name !== value) continue;
    const decl = findDeclaration(file.text, value);
    if (!decl || decl.indent === 0 || decl.kind === 'function') continue;
    const init = file.text.slice(decl.init, decl.init + 80);
    if (
      /^\s*(?:React\.)?(?:useMemo|useRef|useState|useCallback|useSyncExternalStore|use[A-Z]\w*)\b/.test(
        init,
      )
    )
      continue;
    if (/^\s*(?:props\.|[A-Za-z_$][\w$]*\s*[;,\n)]|\w+\.\w+\s*[;\n])/.test(init)) continue;
    report(
      'unstable-identity',
      file,
      decl.index,
      `${value} is created inside the component: each render passes a new ${prop === 'dataSource' ? 'object' : 'array'} as ${prop}${identityCost(prop)}.`,
      'Move it to module scope, or wrap it in useMemo with the values it depends on.',
    );
  }

  // selection-without-row-id
  const selection = bound('selectionMode');
  if (
    selection &&
    !/^['"]?none['"]?$/.test(String(selection.value ?? '').trim()) &&
    !has('getRowId')
  ) {
    report(
      'selection-without-row-id',
      file,
      selection.index,
      'Selection without getRowId: selected ids are row indexes, so they point at other rows after a sort, filter or new data.',
      'Pass getRowId, returning a stable string id per row.',
    );
  }

  if (!selection && has('dataSource') && !has('getRowId')) {
    report(
      'datasource-without-row-id',
      file,
      at,
      "A dataSource without getRowId: row ids are positions in the server's order, so they change with every sort and filter.",
      "Pass getRowId with the server's ids, as strings.",
    );
  }

  // controlled-without-handler
  for (const prop of CONTROLLABLES) {
    const a = attrs.find(
      (x) =>
        x.prop === prop &&
        x.kind !== 'twoWay' &&
        x.kind !== 'event' &&
        !(x.kind === 'static' && fw === 'react'),
    );
    if (!a || spread) continue;
    if (attrs.some((x) => x.kind === 'twoWay' && x.prop === prop)) continue;
    const events = attrs.filter((x) => x.kind === 'event').map((x) => x.name);
    const handlers = [
      eventBindings(`argus-${kebab(prop)}-change`).react,
      `update:${prop}`,
      `${kebab(prop)}-change`,
      camel(`${kebab(prop)}-change`),
      `${prop}Change`,
      `argus-${kebab(prop)}-change`,
    ];
    if (events.some((e) => handlers.includes(e))) continue;
    if (fw === 'vanilla' && vanilla.listeners.has(`argus-${kebab(prop)}-change`)) continue;
    const literal = /^\s*[[{'"`]/.test(String(a.value ?? ''));
    report(
      'controlled-without-handler',
      file,
      a.index,
      `${prop} is bound one-way: the table treats it as controlled, so user changes only fire the event, and nothing changes until you set ${prop} again.`,
      `${literal ? 'For a starting value, call setState() once instead, or bind' : 'Bind'} it two-way: ${fw === 'vue' ? `v-model:${prop}` : fw === 'angular' ? `[(${prop})]` : fw === 'react' ? `${prop} with ${eventBindings(`argus-${kebab(prop)}-change`).react} that stores e.detail.${prop}` : `listen to argus-${kebab(prop)}-change and set it`}; or leave it out.`,
    );
  }

  // Columns: traced to their array.
  const colsAttr = bound('columns');
  const cols =
    colsAttr && colsAttr.kind !== 'static'
      ? ctx.trace(
          ctx.templateOwner.get(file.path) ? ctx.fileOf(ctx.templateOwner.get(file.path)) : file,
          String(colsAttr.value ?? ''),
        )
      : undefined;
  const childColumns = /<(?:ArgusColumn|argus-column)\b/.test(file.text);
  const hasDataSource = has('dataSource');
  checkColumns(cols, file, { report, fromLibraries, hasDataSource, childColumns, at });

  // data-mutated
  const dataAttr = bound('data');
  const dataName = /^(?:this\.)?([A-Za-z_$][\w$]*)(?:\(\)|\.value)?$/.exec(
    String(dataAttr?.value ?? '').trim(),
  )?.[1];
  if (dataName) checkMutation(file, dataName, report);
}

function checkColumns(cols, tableFile, { report, fromLibraries, hasDataSource, childColumns, at }) {
  if (!cols && !childColumns) return;
  // Columns may live in another file (imported): report them there.
  const file = cols?.file ?? tableFile;
  const objects = cols ? objectsInArray(cols.text) : [];
  let sortable =
    childColumns && /<(?:ArgusColumn|argus-column)\b[^>]*\bsortable\b/.test(tableFile.text);
  for (const o of objects) {
    const keys = objectKeys(o.text);
    if (keys.some((k) => k.key === 'sortable')) sortable = true;
    for (const k of keys) {
      if (COLUMN_FIELDS.includes(k.key)) continue;
      const hint = COLUMN_FIELD_RENAMES[k.key];
      report(
        'unknown-column-field',
        file,
        cols.index + o.index + k.index,
        `Column field ${k.key} isn't part of a ColumnDef${hint ? `; it's ${hint} here` : ''}.`,
        hint ? `Rename it to ${hint}.` : `ColumnDef fields: ${COLUMN_FIELDS.join(', ')}.`,
      );
    }
    if (
      hasDataSource &&
      /^['"]set['"]$/.test(objectValue(o.text, 'filter') ?? '') &&
      !keys.some((k) => k.key === 'filterOptions')
    ) {
      report(
        'set-filter-needs-options',
        file,
        cols.index + o.index,
        "A 'set' filter with a dataSource needs filterOptions: the table can't list values from rows it hasn't loaded.",
        'Add filterOptions: the values to offer (from your API).',
      );
    }
  }
  if ((objects.length || childColumns) && !sortable) {
    const sortsByDefault = LIBRARIES.filter((l) => fromLibraries.has(l.id) && l.sortsByDefault);
    report(
      'sortable-never-set',
      file,
      cols ? cols.index : at,
      `No column is sortable: argus-table sorts only columns with sortable: true${sortsByDefault.length ? `, and ${sortsByDefault.map((l) => l.name).join(', ')} sorted every column by default` : ''}.`,
      'Add sortable: true to the columns users should sort.',
      sortsByDefault.length ? 'warn' : 'info',
    );
  }
}

function checkMutation(file, name, report) {
  if (/\.refresh\s*\(/.test(file.text)) return;
  const esc = name.replace(/\$/g, '\\$');
  const re = new RegExp(
    `(?<![\\w$.\\]])(?:this\\.)?${esc}(?:\\.value|\\(\\))?(?:\\.(push|splice|unshift|pop|shift|sort|reverse|fill|copyWithin)\\s*\\(|\\[[^\\]\\n]+\\]\\s*=(?!=))`,
    'g',
  );
  for (const m of file.text.matchAll(re)) {
    report(
      'data-mutated',
      file,
      m.index,
      `${name} is changed in place${m[1] ? ` (.${m[1]}())` : ''}: the table doesn't see changes inside the same array.`,
      `Give data a new array (${name} = [...${name}, row]), or call table.refresh() after changing rows in place.`,
    );
    return;
  }
}

/**
 * The array literal a binding value points at: inline, a variable or getter
 * in the file, or a variable imported from another file of the project.
 */
function traceArray(file, value, { resolver, fileOf }) {
  const v = value.trim();
  if (v.startsWith('[')) {
    const index = file.text.indexOf(v);
    return index === -1 ? undefined : { text: v, index, file };
  }
  const name = /^(?:this\.)?([A-Za-z_$][\w$]*)(?:\(\)|\.value)?$/.exec(v)?.[1];
  if (!name) return undefined;
  const fromDecl = (target) => {
    const decl = findDeclaration(target.text, name);
    if (!decl || decl.kind === 'function') return undefined;
    let from = decl.init;
    if (decl.kind === 'getter') {
      const ret = /\breturn\b/.exec(target.text.slice(decl.init, decl.init + 400));
      if (!ret) return undefined;
      from = decl.init + ret.index + ret[0].length;
    }
    const arr = arrayAt(target.text, from);
    return arr ? { ...arr, file: target } : undefined;
  };
  const local = fromDecl(file);
  if (local || findDeclaration(file.text, name)) return local;
  const esc = name.replace(/\$/g, '\\$');
  const m = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${esc}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`,
  ).exec(file.text);
  const target = m ? resolver(m[1], file.path) : undefined;
  return target ? fromDecl(fileOf(target)) : undefined;
}

/** What a new identity costs the table, for unstable-identity messages. */
function identityCost(prop) {
  if (prop === 'plugins') return ': new plugin instances reconnect, and open menus close';
  if (prop === 'dataSource') return ': a new source reloads its rows from the top';
  return ': the table re-resolves the columns and re-reads every row';
}

/** Property assignments and listeners on tables made in plain scripts (`table.columns = …`). */
function vanillaBindings(files, trace) {
  const props = new Map();
  const listeners = new Set();
  const out = { props, listeners, label: false, files: [], columns: [] };
  const propNames = Object.keys(PROPERTIES).join('|');
  for (const file of files) {
    if (!SCRIPT_EXTS.has(file.ext) && file.ext !== '.html') continue;
    if (/\.[jt]sx$/.test(file.ext) || /from\s+['"](?:react|vue|@angular\/core)['"]/.test(file.text))
      continue;
    if (!/argus-table|ArgusTable|argus-[a-z-]+-change|['"]argus-/.test(file.text)) continue;
    let any = false;
    for (const m of file.text.matchAll(new RegExp(`\\.(${propNames})\\s*=(?!=)`, 'g'))) {
      any = true;
      if (!props.has(m[1])) props.set(m[1], { file, index: m.index ?? 0 });
      if (m[1] === 'columns') {
        const after = (m.index ?? 0) + m[0].length;
        const ident = /^\s*([A-Za-z_$][\w$]*)\s*[;\n]/.exec(
          file.text.slice(after, after + 80),
        )?.[1];
        const arr = arrayAt(file.text, after) ?? (ident ? trace(file, ident) : undefined);
        if (arr) out.columns.push({ file, arr: { ...arr, file: arr.file ?? file } });
      }
    }
    for (const m of file.text.matchAll(/addEventListener\(\s*['"](argus-[\w-]+)['"]/g)) {
      any = true;
      listeners.add(m[1]);
    }
    if (/setAttribute\(\s*['"]aria-label(?:ledby)?['"]|\.ariaLabel\s*=/.test(file.text))
      out.label = true;
    if (any) out.files.push(file);
  }
  return out;
}

function checkVanilla(vanilla, tables, { report, fromLibraries }) {
  const listed = (name) => ({
    file: vanilla.props.get(name).file,
    index: vanilla.props.get(name).index,
  });
  const htmlTags = tables.filter((t) => t.framework === 'vanilla');
  for (const file of vanilla.files) {
    for (const m of file.text.matchAll(/addEventListener\(\s*['"](argus-[\w-]+)['"]/g)) {
      if ([...EVENTS, ...ADDON_EVENTS].includes(m[1])) continue;
      const old = RENAMED_EVENTS[m[1]];
      report(
        'unknown-event',
        file,
        m.index,
        `${m[1]} is not an event of the table.`,
        old ? `It was renamed: ${old}.` : `The table's events: ${EVENTS.join(', ')}.`,
      );
    }
    for (const m of file.text.matchAll(
      /setAttribute\(\s*['"](columns|data|data-source|plugins|sorting|pinned-rows|get-row-id)['"]/g,
    )) {
      report(
        'attribute-for-property',
        file,
        m.index,
        `setAttribute('${m[1]}', …) can't pass objects or functions.`,
        `table.${camel(m[1])} = … (a property).`,
      );
    }
  }
  // Selection and controlled state set from scripts, for tables in HTML.
  // (A selection-mode attribute on an HTML tag is checked with its tag.)
  if (
    vanilla.props.has('selectionMode') &&
    !vanilla.props.has('getRowId') &&
    !htmlTags.some((t) => t.tag.attrs.some((a) => a.name === 'get-row-id'))
  ) {
    const { file, index } = listed('selectionMode');
    report(
      'selection-without-row-id',
      file,
      index,
      'Selection without getRowId: selected ids are row indexes, so they point at other rows after a sort, filter or new data.',
      'Set table.getRowId = (row) => String(row.id).',
    );
  }
  for (const prop of CONTROLLABLES) {
    if (!vanilla.props.has(prop) || vanilla.listeners.has(`argus-${kebab(prop)}-change`)) continue;
    const { file, index } = listed(prop);
    report(
      'controlled-without-handler',
      file,
      index,
      `table.${prop} is set, so the table treats it as controlled: user changes only fire argus-${kebab(prop)}-change, and nothing changes until you set it again.`,
      `Listen to argus-${kebab(prop)}-change and set table.${prop} = e.detail.${prop}; for a starting value use table.setState({ ${prop} }) once instead.`,
    );
  }
  for (const { file, arr } of vanilla.columns) {
    checkColumns(arr, file, {
      report,
      fromLibraries,
      hasDataSource: vanilla.props.has('dataSource'),
      childColumns: false,
      at: arr.index,
    });
  }
  if (vanilla.props.has('data')) {
    const { file } = listed('data');
    const m = /\.data\s*=\s*(?!await\b|new\b)([A-Za-z_$][\w$]*)\s*(?:;|\n)/.exec(file.text);
    if (m) checkMutation(file, m[1], report);
  }
}

function themesIn(dir, files, styles) {
  const names = new Set();
  const re = /@argus-table\/themes(?:@[\w.^~-]+)?(?:\/dist)?\/(\w+)\.css/g;
  for (const f of [...files, ...styles]) for (const m of f.text.matchAll(re)) names.add(m[1]);
  for (const name of [
    'angular.json',
    'nuxt.config.ts',
    'nuxt.config.js',
    'nuxt.config.mjs',
    'index.html',
  ]) {
    for (const m of (read(join(dir, name)) ?? '').matchAll(re)) names.add(m[1]);
  }
  return names;
}

function projectHasTheme(dir, files, styles) {
  return themesIn(dir, files, styles).size > 0;
}

function pmRemove(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm remove';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn remove';
  if (existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb')))
    return 'bun remove';
  return 'npm uninstall';
}

/** Applies severities, suppressions, --only and --ignore; sorts. */
function filterFindings(findings, options, fileOf, root) {
  const out = [];
  const seen = new Set();
  for (const f of findings) {
    f.severity ??= RULES[f.rule];
    if (options.only && !options.only.includes(f.rule)) continue;
    if (options.ignore.includes(f.rule)) continue;
    const key = `${f.rule}|${String(f.file)}|${String(f.line)}|${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (f.file && f.line) {
      const file = fileOf(resolve(root, f.file));
      const here = file.lines[f.line - 1] ?? '';
      const before = file.lines[f.line - 2] ?? '';
      const suppressed = (line, marker) => {
        const m = new RegExp(`${marker}(?![\\w-])\\s*([\\w,\\s-]*)`).exec(line);
        if (!m) return false;
        const ids = m[1].split(/[\s,]+/).filter((id) => id in RULES);
        return ids.length === 0 || ids.includes(f.rule);
      };
      if (
        suppressed(here, 'argus-check-ignore') ||
        suppressed(before, 'argus-check-ignore-next-line')
      )
        continue;
    }
    out.push(f);
  }
  const order = { error: 0, warn: 1, info: 2 };
  return out.sort(
    (a, b) =>
      String(a.file).localeCompare(String(b.file)) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      order[a.severity] - order[b.severity],
  );
}

function text(findings) {
  const lines = [];
  for (const f of findings) {
    lines.push(
      `${f.file ?? '.'}${f.line ? `:${String(f.line)}` : ''}  ${f.severity}  ${f.rule}  ${f.message}`,
    );
    if (f.fix) lines.push(`    fix: ${f.fix}`);
    lines.push(`    see: references/pitfalls.md#${f.rule}`);
  }
  const count = (s) => findings.filter((f) => f.severity === s).length;
  lines.push(
    `${findings.length ? '\n' : ''}${String(count('error'))} errors, ${String(count('warn'))} warnings, ${String(count('info'))} notes.`,
  );
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
  let findings;
  try {
    findings = check(options);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  console.log(
    options.json
      ? JSON.stringify({ tool: 'argus-table-integrate/check', findings }, null, 2)
      : text(findings),
  );
  const failing = findings.filter(
    (f) => f.severity === 'error' || (options.strict && f.severity === 'warn'),
  );
  return failing.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
