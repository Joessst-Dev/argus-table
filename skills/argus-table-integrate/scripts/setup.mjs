#!/usr/bin/env node
// Prints how to add argus-table to a project: the install command for its
// package manager (and workspace), the packages at matching versions, where
// the theme goes, the imports and the first steps for its framework.
//
//   node setup.mjs [--cwd <app dir>] [--framework react|vue|angular|vanilla]
//                  [--theme default|material|fluent|bootstrap|minimal|none]
//                  [--addons header-menu,formulas,export] [--pm npm|pnpm|yarn|bun]
//                  [--version <x.y.z>] [--cdn] [--json]
//
// Read-only: it prints the command and never runs it.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADDONS,
  MIN_VERSION,
  THEMES,
  WRAPPERS,
  compareVersions,
  minVersion,
  parseVersion,
} from './lib/api.mjs';
import {
  argusPackages,
  dependencies,
  detectFramework,
  findRoot,
  packageManager,
  themeTargets,
  workspaces,
} from './lib/project.mjs';
import {
  ADDON_IMPORTS,
  IMPORTS,
  SETUP,
  cdnTags,
  metaNotes,
  themeStatement,
} from './lib/templates.mjs';
import { read, readJson, rel } from './lib/walk.mjs';

const USAGE = `Usage: node setup.mjs [--cwd <app dir>] [--framework react|vue|angular|vanilla]
                     [--theme ${[...THEMES, 'none'].join('|')}]
                     [--addons header-menu,formulas,export] [--pm npm|pnpm|yarn|bun]
                     [--version <x.y.z>] [--cdn] [--json]`;

const ADDON_NAMES = Object.keys(ADDONS).map((a) => a.replace('@argus-table/', ''));

/** Parses the command line; throws a usage error. */
export function parseArgs(args) {
  const options = {
    cwd: '.',
    framework: undefined,
    theme: 'default',
    addons: [],
    pm: undefined,
    version: undefined,
    cdn: false,
    json: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => {
      const v = args[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value.`);
      return v;
    };
    if (a === '--cwd') options.cwd = value();
    else if (a === '--framework') {
      options.framework = value();
      if (!['react', 'vue', 'angular', 'vanilla'].includes(options.framework))
        throw new Error(`Unknown framework "${options.framework}".`);
    } else if (a === '--theme') {
      options.theme = value();
      if (![...THEMES, 'none'].includes(options.theme))
        throw new Error(`Unknown theme "${options.theme}". Themes: ${THEMES.join(', ')}, none.`);
    } else if (a === '--addons') {
      options.addons = value()
        .split(',')
        .map((s) => s.trim().replace(/^@argus-table\//, ''))
        .filter(Boolean);
      const unknown = options.addons.filter((s) => !ADDON_NAMES.includes(s));
      if (unknown.length)
        throw new Error(`Unknown add-on "${unknown[0]}". Add-ons: ${ADDON_NAMES.join(', ')}.`);
    } else if (a === '--pm') {
      options.pm = value();
      if (!['npm', 'pnpm', 'yarn', 'bun'].includes(options.pm))
        throw new Error(`Unknown package manager "${options.pm}".`);
    } else if (a === '--version') {
      options.version = value().replace(/^v/, '');
      if (!parseVersion(options.version) || !/^\d+\.\d+\.\d+/.test(options.version))
        throw new Error(`--version needs x.y.z, not "${options.version}".`);
    } else if (a === '--cdn') options.cdn = true;
    else if (a === '--json') options.json = true;
    else throw new Error(`Unknown option ${a}.`);
  }
  return options;
}

/** The install plan for `options.cwd`. */
export function plan(options) {
  const dir = resolve(options.cwd);
  const root = findRoot(dir);
  const pm = packageManager(root);
  if (options.pm)
    Object.assign(pm, {
      name: options.pm,
      source: 'option',
      yarnBerry: options.pm === 'yarn' && pm.yarnBerry,
      autoInstallPeers: options.pm !== 'yarn',
    });
  const detected = detectFramework(dir, root);
  const typescript =
    existsSync(join(dir, 'tsconfig.json')) ||
    'typescript' in
      {
        ...dependencies(readJson(join(root, 'package.json'))),
        ...dependencies(readJson(join(dir, 'package.json'))),
      };
  const frameworkName =
    options.framework ??
    (['react', 'vue', 'angular'].includes(detected.name) ? detected.name : 'vanilla');
  const warnings = [];
  const notes = metaNotes(detected);
  if (detected.name in WRAPPERS && !detected.supported) {
    warnings.push(
      `${detected.package} ${String(detected.version)} is outside what ${WRAPPERS[detected.name]} supports; upgrade it, or use the element directly (--framework vanilla).`,
    );
  }
  if (options.framework && options.framework !== detected.name && detected.name !== 'vanilla') {
    warnings.push(`The project looks like ${detected.name}, not ${options.framework}.`);
  }

  // Versions: match what's installed (one release for every package), else the latest.
  const argus = argusPackages(dir, root);
  const installed = argus.version;
  let spec;
  let versionNote;
  if (options.version) {
    spec = options.version;
    if (compareVersions(spec, MIN_VERSION) < 0)
      warnings.push(
        `${spec} is older than ${MIN_VERSION}, the release this skill's references describe.`,
      );
  } else if (installed && compareVersions(installed, MIN_VERSION) >= 0) {
    spec = installed;
    versionNote = `matches the installed argus-table ${installed}`;
  } else if (installed) {
    spec = `^${MIN_VERSION}`;
    versionNote = `argus-table ${installed} is installed: upgrade every argus-table package together to ${MIN_VERSION} or later`;
  }
  const at = (name) => (spec ? `${name}@${spec}` : name);

  const wanted = [];
  const add = (name, reason) => {
    if (!wanted.some((w) => w.name === name)) wanted.push({ name, reason });
  };
  if (!options.cdn) {
    if (frameworkName in WRAPPERS) add(WRAPPERS[frameworkName], 'wrapper');
    add(
      'argus-table',
      frameworkName in WRAPPERS
        ? 'the element (a direct dependency, for the add-ons and strict installs)'
        : 'the element',
    );
    if (options.theme !== 'none') add('@argus-table/themes', 'theme');
    for (const addon of options.addons) add(`@argus-table/${addon}`, 'add-on');
    const deps = {
      ...dependencies(readJson(join(root, 'package.json'))),
      ...dependencies(readJson(join(dir, 'package.json'))),
    };
    const needsLit = options.addons.some((a) => ADDONS[`@argus-table/${a}`].peers.includes('lit'));
    if (needsLit && !pm.autoInstallPeers && !('lit' in deps))
      add('lit', 'peer of the add-ons (your package manager does not install peers)');
    // Upgrading: every argus package already installed moves too.
    // Every argus package already there moves to the same version.
    if (spec) {
      for (const [name, info] of Object.entries(argus.packages)) {
        if ((info.version ?? minVersion(info.range ?? undefined)) !== spec.replace(/^\^/, ''))
          add(name, 'align with the others');
      }
    }
  }
  const packages = wanted.map((w) => ({
    name: w.name,
    spec: w.name === 'lit' ? '^3.3.0' : (spec ?? 'latest'),
    reason: w.reason,
  }));
  const args = wanted.map((w) => (w.name === 'lit' ? 'lit@^3.3.0' : at(w.name)));
  const command = options.cdn ? null : installCommand(pm, root, dir, args);

  // The theme: in the first usual place that exists.
  const targets = themeTargets(dir, detected);
  const themeFile = options.cdn ? null : (targets[0] ?? null);
  const themePresent = argus.packages['@argus-table/themes']
    ? targets.some((t) => (read(join(dir, t)) ?? '').includes('@argus-table/themes/'))
    : false;
  const theme =
    options.theme === 'none'
      ? null
      : {
          name: options.theme,
          file: themeFile,
          statement: options.cdn ? null : themeStatement(options.theme, themeFile ?? 'src/main.ts'),
          alreadyPresent: themePresent,
          note: 'Import one theme, once, before your own CSS (so your token overrides win). It loads no fonts: set --argus-font: inherit on argus-table to keep the page font.',
        };

  return {
    tool: 'argus-table-integrate/setup',
    cwd: rel(root, dir) || '.',
    packageManager: pm.name,
    framework: frameworkName,
    meta: detected.meta.name,
    version: spec ?? 'latest',
    versionNote:
      versionNote ??
      (spec
        ? undefined
        : "npm's current release; every argus-table package is released at the same version, so they match"),
    command,
    packages,
    cdn: options.cdn
      ? cdnTags(
          spec?.replace(/^\^/, '') ?? undefined,
          options.theme,
          options.addons.map((a) => `@argus-table/${a}`),
        )
      : null,
    theme,
    imports: options.cdn
      ? []
      : [
          ...IMPORTS[frameworkName].filter(
            (line) => typescript || !line.includes('TypeScript only'),
          ),
          ...options.addons.map((a) => ADDON_IMPORTS[`@argus-table/${a}`]),
        ],
    plugins: options.addons.length
      ? `[${['export', 'formulas', 'header-menu']
          .filter((a) => options.addons.includes(a))
          .map((a) => `${ADDONS[`@argus-table/${a}`].factory}()`)
          .join(', ')}]`
      : null,
    setup: SETUP[frameworkName],
    notes,
    warnings,
    next: `node ${fileURLToPath(new URL('./check.mjs', import.meta.url))} ${dir}`,
    nextMigration:
      'After a migration, add --scan <the scan.json you saved> to also find the old library left behind.',
  };
}

/** The install command for a package manager, in a workspace if `dir` is one. */
export function installCommand(pm, root, dir, args) {
  const inWorkspace = dir !== root && workspaces(root).includes(dir);
  const name = readJson(join(dir, 'package.json'))?.name;
  const path = rel(root, dir);
  const list = args.join(' ');
  switch (pm.name) {
    case 'pnpm':
      return inWorkspace ? `pnpm --filter ${name ?? `./${path}`} add ${list}` : `pnpm add ${list}`;
    case 'yarn':
      return inWorkspace && name ? `yarn workspace ${name} add ${list}` : `yarn add ${list}`;
    case 'bun':
      return inWorkspace ? `bun add --cwd ${path} ${list}` : `bun add ${list}`;
    default:
      return inWorkspace ? `npm install ${list} -w ${path}` : `npm install ${list}`;
  }
}

function text(p) {
  const lines = [];
  if (p.command) lines.push('Install:', `  ${p.command}`, '');
  if (p.versionNote) lines.push(`Version: ${p.version} (${p.versionNote})`, '');
  if (p.cdn)
    lines.push(
      'Without a bundler, in the page (never together with an npm import of argus-table):',
      ...p.cdn.map((l) => `  ${l}`),
      '',
    );
  if (p.theme?.statement) {
    lines.push(
      `Theme${p.theme.alreadyPresent ? ' (already imported)' : ''}: in ${p.theme.file ?? 'your entry file'}`,
      `  ${p.theme.statement}`,
      `  ${p.theme.note}`,
      '',
    );
  }
  if (p.imports.length) lines.push('Imports:', ...p.imports.map((l) => `  ${l}`), '');
  if (p.plugins) lines.push(`Plugins, in this order: plugins = ${p.plugins}`, '');
  lines.push(`Setup (${p.framework}):`, ...p.setup.map((l) => `  - ${l}`));
  if (p.notes.length) lines.push('', 'Notes:', ...p.notes.map((l) => `  - ${l}`));
  if (p.warnings.length) lines.push('', 'Warnings:', ...p.warnings.map((l) => `  ! ${l}`));
  lines.push('', `Then check: ${p.next}`, `  ${p.nextMigration}`);
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
  if (!readJson(join(resolve(options.cwd), 'package.json')) && !options.cdn) {
    console.error(
      `No package.json in ${resolve(options.cwd)}. Point --cwd at the app, or use --cdn for a page without a bundler.`,
    );
    return 1;
  }
  const result = plan(options);
  console.log(options.json ? JSON.stringify(result, null, 2) : text(result));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
