// What a project is: its package manager, workspaces, framework and
// meta-framework, TypeScript, and which argus-table packages it has at which
// versions. Reads files only; never runs the package manager or the network.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  FRAMEWORK_PEERS,
  MIN_VERSION,
  PACKAGES,
  WRAPPERS,
  compareVersions,
  minVersion,
} from './api.mjs';
import { read, readJson, rel } from './walk.mjs';

/** All dependencies of a package.json, by name → range. */
export function dependencies(pkg) {
  return {
    ...(pkg?.peerDependencies ?? {}),
    ...(pkg?.optionalDependencies ?? {}),
    ...(pkg?.devDependencies ?? {}),
    ...(pkg?.dependencies ?? {}),
  };
}

/** Finds the root of the repository or workspace that holds `dir`. */
export function findRoot(dir) {
  let current = resolve(dir);
  const best = existsSync(join(current, 'package.json')) ? current : undefined;
  for (;;) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    const pkg = readJson(join(current, 'package.json'));
    if (pkg?.workspaces || existsSync(join(current, 'pnpm-workspace.yaml'))) {
      // Only a workspace root that lists this folder: a standalone app inside a repo keeps its own root.
      return best === undefined || workspaces(current).includes(best) ? current : best;
    }
    if (existsSync(join(current, '.git'))) break;
  }
  return best ?? resolve(dir);
}

/** The package manager, from lockfiles, then `packageManager`, else npm. */
export function packageManager(root) {
  const pkg = readJson(join(root, 'package.json'));
  const field = typeof pkg?.packageManager === 'string' ? pkg.packageManager : undefined;
  const fieldName = field?.split('@')[0];
  const fieldVersion = field?.split('@')[1]?.split('+')[0];
  const locks = [
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['bun', 'bun.lock'],
    ['bun', 'bun.lockb'],
    ['npm', 'package-lock.json'],
    ['npm', 'npm-shrinkwrap.json'],
  ];
  let name;
  let lockfile;
  let source = 'default';
  for (const [manager, file] of locks) {
    if (existsSync(join(root, file))) {
      name = manager;
      lockfile = file;
      source = 'lockfile';
      break;
    }
  }
  if (!name && fieldName && ['npm', 'pnpm', 'yarn', 'bun'].includes(fieldName)) {
    name = fieldName;
    source = 'packageManager';
  }
  name ??= 'npm';
  const version = fieldName === name ? fieldVersion : undefined;
  const yarnBerry =
    name === 'yarn' &&
    (existsSync(join(root, '.yarnrc.yml')) ||
      (version !== undefined && Number(version.split('.')[0]) >= 2));
  const npmrc = read(join(root, '.npmrc')) ?? '';
  // npm 7+, pnpm 8+ and bun install peers; yarn (1 and berry) doesn't.
  const autoInstallPeers = name !== 'yarn' && !/^\s*auto-install-peers\s*=\s*false/m.test(npmrc);
  return { name, version, lockfile, source, yarnBerry, autoInstallPeers };
}

/** Workspace folders (with a package.json) listed by package.json `workspaces` or pnpm-workspace.yaml. */
export function workspaces(root) {
  const pkg = readJson(join(root, 'package.json'));
  let patterns = [];
  if (Array.isArray(pkg?.workspaces)) patterns = pkg.workspaces;
  else if (Array.isArray(pkg?.workspaces?.packages)) patterns = pkg.workspaces.packages;
  const yaml = read(join(root, 'pnpm-workspace.yaml'));
  if (yaml) {
    const block = /(?:^|\n)packages:\s*\n((?:[ \t]*(?:-.*|#.*)?\n?)*)/.exec(yaml);
    for (const line of (block?.[1] ?? '').split('\n')) {
      const m = /^\s*-\s*['"]?([^'"#\n]+?)['"]?\s*(?:#.*)?$/.exec(line);
      if (m) patterns.push(m[1]);
    }
  }
  const excluded = patterns
    .filter((p) => p.startsWith('!'))
    .map((p) => p.slice(1).replace(/\/$/, ''));
  const dirs = new Set();
  for (const pattern of patterns.filter((p) => !p.startsWith('!'))) {
    for (const dir of expand(root, pattern.replace(/\/$/, ''))) {
      const relative = rel(root, dir);
      if (
        excluded.some(
          (e) => e === relative || (e.endsWith('/**') && relative.startsWith(e.slice(0, -2))),
        )
      )
        continue;
      if (existsSync(join(dir, 'package.json'))) dirs.add(dir);
    }
  }
  return [...dirs].sort();
}

/** Expands `apps/*`, `packages/**` and plain paths (no other glob features). */
function expand(root, pattern) {
  const parts = pattern.split('/');
  let current = [root];
  for (const part of parts) {
    const next = [];
    for (const dir of current) {
      if (part === '**') {
        next.push(...descendants(dir, 4));
      } else if (part.includes('*')) {
        const re = new RegExp(
          `^${part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
        );
        for (const child of children(dir)) if (re.test(child)) next.push(join(dir, child));
      } else {
        next.push(join(dir, part));
      }
    }
    current = next;
  }
  return current;
}

function children(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function descendants(dir, depth) {
  const all = [dir];
  if (depth === 0) return all;
  for (const child of children(dir)) all.push(...descendants(join(dir, child), depth - 1));
  return all;
}

/** The monorepo tool, if any. */
export function monorepoTool(root, pm) {
  if (existsSync(join(root, 'nx.json'))) return 'nx';
  if (existsSync(join(root, 'turbo.json'))) return 'turbo';
  if (existsSync(join(root, 'lerna.json'))) return 'lerna';
  if (workspaces(root).length) return pm.name;
  return null;
}

/** The framework and meta-framework of the project in `dir`. */
export function detectFramework(dir, root) {
  const pkg = readJson(join(dir, 'package.json')) ?? {};
  const deps = dependencies(pkg);
  const has = (name) => name in deps;
  const version = (name) => installedVersion(name, dir, root).version ?? minVersion(deps[name]);

  let name = 'vanilla';
  let framework;
  if (has('@angular/core')) framework = '@angular/core';
  else if (has('vue') || has('nuxt')) framework = has('vue') ? 'vue' : 'nuxt';
  else if (has('react') || has('next')) framework = has('react') ? 'react' : 'next';
  else if (has('svelte') || has('@sveltejs/kit')) framework = 'svelte';
  else if (has('solid-js')) framework = 'solid-js';
  if (framework === '@angular/core') name = 'angular';
  else if (framework === 'vue' || framework === 'nuxt') name = 'vue';
  else if (framework === 'react' || framework === 'next') name = 'react';
  else if (framework === 'svelte') name = 'svelte';
  else if (framework === 'solid-js') name = 'solid';
  else if (has('lit') || has('@lit/react')) name = 'vanilla';

  const peer = FRAMEWORK_PEERS[name];
  const fwVersion = peer ? version(peer.package) : framework ? version(framework) : undefined;
  const supported = peer
    ? fwVersion === undefined ||
      (compareVersions(fwVersion, peer.min) >= 0 && compareVersions(fwVersion, peer.below) < 0)
    : name === 'vanilla' || name === 'svelte' || name === 'solid';

  let meta = null;
  let ssr = false;
  let rsc = false;
  const metas = [
    ['next', 'next'],
    ['nuxt', 'nuxt'],
    ['@remix-run/react', 'remix'],
    ['@react-router/dev', 'react-router'],
    ['@analogjs/platform', 'analog'],
    ['astro', 'astro'],
    ['@sveltejs/kit', 'sveltekit'],
    ['@angular/ssr', 'angular-ssr'],
    ['@nguniversal/express-engine', 'angular-ssr'],
    ['@angular/cli', 'angular-cli'],
    ['@angular/build', 'angular-cli'],
    ['vite', 'vite'],
    ['webpack', 'webpack'],
  ];
  for (const [dep, label] of metas) {
    if (has(dep)) {
      meta = label;
      break;
    }
  }
  if (!meta && existsSync(join(dir, 'angular.json'))) meta = 'angular-cli';
  let appDir = null;
  let pagesDir = null;
  if (meta === 'next') {
    for (const d of ['app', 'src/app']) if (isDir(join(dir, d))) appDir = d;
    for (const d of ['pages', 'src/pages']) if (isDir(join(dir, d))) pagesDir = d;
    ssr = true;
    rsc = appDir !== null;
  } else if (
    ['nuxt', 'remix', 'react-router', 'analog', 'astro', 'sveltekit', 'angular-ssr'].includes(meta)
  ) {
    ssr = true;
  }
  return {
    name,
    package: peer?.package ?? framework ?? null,
    version: fwVersion ?? null,
    range: (peer && deps[peer.package]) ?? (framework ? deps[framework] : null) ?? null,
    supported,
    meta: {
      name: meta,
      version: meta ? (version(metaPackage(meta, deps)) ?? null) : null,
      ssr,
      rsc,
      appDir,
      pagesDir,
    },
  };
}

function metaPackage(meta, deps) {
  const map = {
    next: 'next',
    nuxt: 'nuxt',
    remix: '@remix-run/react',
    'react-router': '@react-router/dev',
    analog: '@analogjs/platform',
    astro: 'astro',
    sveltekit: '@sveltejs/kit',
    'angular-ssr': '@angular/ssr',
    'angular-cli': '@angular/cli' in deps ? '@angular/cli' : '@angular/build',
    vite: 'vite',
    webpack: 'webpack',
  };
  return map[meta];
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The version of a package the project gets: from `node_modules` (walking up
 * to the root, for hoisted installs), else the lockfile, else undefined.
 */
export function installedVersion(name, dir, root) {
  let current = resolve(dir);
  const top = resolve(root);
  for (;;) {
    const pkg = readJson(join(current, 'node_modules', name, 'package.json'));
    if (pkg?.version) return { version: pkg.version, source: 'node_modules' };
    if (current === top) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const exact = importerVersion(name, dir, root);
  if (exact) return { version: exact, source: 'lockfile' };
  const locked = lockedVersions(name, root);
  if (locked.length) {
    return {
      version: [...locked].sort(compareVersions)[locked.length - 1],
      source: 'lockfile',
      all: locked,
    };
  }
  return { version: undefined, source: undefined };
}

/** The version the lockfile resolves for this project's own dependency (pnpm importers, npm workspaces, yarn ranges). */
function importerVersion(name, dir, root) {
  const importer = rel(root, dir) || '.';
  const pnpm = read(join(root, 'pnpm-lock.yaml'));
  if (pnpm) {
    const start = pnpm.search(new RegExp(`^  ['"]?${escape(importer)}['"]?:\\s*$`, 'm'));
    if (start !== -1) {
      const rest = pnpm.slice(start).split('\n');
      const block = [rest[0]];
      for (const line of rest.slice(1)) {
        if (/^ {0,2}\S/.test(line)) break;
        block.push(line);
      }
      const text = block.join('\n');
      const m = new RegExp(
        `^ {6}['"]?${escape(name)}['"]?:\\s*\\n {8}specifier:.*\\n {8}version:\\s*['"]?([\\w.-]+)`,
        'm',
      ).exec(text);
      if (m) return m[1];
    }
  }
  const npm = readJson(join(root, 'package-lock.json'));
  if (npm?.packages) {
    const prefix = importer === '.' ? '' : `${importer}/`;
    const entry =
      npm.packages[`${prefix}node_modules/${name}`] ?? npm.packages[`node_modules/${name}`];
    if (entry?.version) return entry.version;
  }
  const range = dependencies(readJson(join(dir, 'package.json')))[name];
  const yarn = range ? read(join(root, 'yarn.lock')) : undefined;
  if (yarn && range) {
    const header = new RegExp(
      `^[^\\s#][^\\n]*["\\s,]?${escape(name)}@(?:npm:)?${escape(range)}["\\s,:][^\\n]*\\n(?:[ \\t]+[^\\n]*\\n)*?[ \\t]+version:?\\s+"?([\\w.-]+)"?`,
      'm',
    );
    const m = header.exec(yarn);
    if (m) return m[1];
  }
  return undefined;
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const lockCache = new Map();

/** Every version of a package the root's lockfile holds. */
export function lockedVersions(name, root) {
  const key = `${root}\0${name}`;
  if (lockCache.has(key)) return lockCache.get(key);
  const versions = new Set();
  const esc = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const pnpm = read(join(root, 'pnpm-lock.yaml'));
  if (pnpm) {
    const re = new RegExp(`^\\s+['"]?/?${esc}@(\\d+\\.\\d+\\.\\d+[\\w.-]*)(?:\\(|['"]?:)`, 'gm');
    for (const m of pnpm.matchAll(re)) versions.add(m[1]);
  }
  const npm = readJson(join(root, 'package-lock.json'));
  if (npm?.packages) {
    for (const [path, entry] of Object.entries(npm.packages)) {
      if (
        (path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)) &&
        entry?.version
      ) {
        versions.add(entry.version);
      }
    }
  }
  const yarn = read(join(root, 'yarn.lock'));
  if (yarn) {
    const re = new RegExp(
      `^"?${esc}@[^\\n]*:\\n(?:[ \\t]+[^\\n]*\\n)*?[ \\t]+version:?\\s+"?([\\w.-]+)"?`,
      'gm',
    );
    for (const m of yarn.matchAll(re)) versions.add(m[1]);
  }
  const bun = read(join(root, 'bun.lock'));
  if (bun) {
    const re = new RegExp(`"${esc}":\\s*\\[\\s*"${esc}@(\\d+\\.\\d+\\.\\d+[\\w.-]*)"`, 'g');
    for (const m of bun.matchAll(re)) versions.add(m[1]);
  }
  const list = [...versions];
  lockCache.set(key, list);
  return list;
}

/** The argus-table packages a project has: declared range, installed version, and problems. */
export function argusPackages(dir, root) {
  const pkg = readJson(join(dir, 'package.json')) ?? {};
  const rootPkg = dir === root ? pkg : (readJson(join(root, 'package.json')) ?? {});
  const deps = dependencies(pkg);
  const rootDeps = dependencies(rootPkg);
  const packages = {};
  for (const name of PACKAGES) {
    const range = deps[name] ?? rootDeps[name];
    const installed = installedVersion(name, dir, root);
    if (range === undefined && installed.source !== 'node_modules') continue;
    packages[name] = {
      range: range ?? null,
      version: installed.version ?? null,
      source: installed.version ? installed.source : range ? 'range' : null,
      direct: name in deps || name in rootDeps,
    };
  }
  // The wrappers bring argus-table along even when it isn't listed.
  const versionOf = (name) =>
    packages[name]?.version ?? minVersion(packages[name]?.range ?? undefined);
  const known = Object.keys(packages)
    .map((name) => ({ name, version: versionOf(name), exact: Boolean(packages[name].version) }))
    .filter((p) => p.version);
  const exact = known.filter((p) => p.exact);
  const distinct = new Set(exact.map((p) => p.version));
  const distinctRanges = new Set(known.map((p) => p.version));
  const mismatched =
    distinct.size > 1 || (exact.length === 0 && distinctRanges.size > 1)
      ? known.map((p) => `${p.name}@${p.version}`)
      : [];
  const duplicates =
    lockedVersions('argus-table', root).length > 1 ? lockedVersions('argus-table', root) : [];
  for (const wrapper of [
    ...Object.values(WRAPPERS),
    '@argus-table/header-menu',
    '@argus-table/formulas',
    '@argus-table/export',
  ]) {
    for (const base of [dir, root]) {
      const nested = readJson(
        join(base, 'node_modules', wrapper, 'node_modules', 'argus-table', 'package.json'),
      );
      if (nested?.version) duplicates.push(`${wrapper} → argus-table@${nested.version}`);
    }
  }
  const versions = known.map((p) => p.version).sort(compareVersions);
  const highest = versions[versions.length - 1];
  return {
    packages,
    version: highest ?? null,
    mismatched,
    duplicates: [...new Set(duplicates)],
    minimum: MIN_VERSION,
    belowMinimum: highest !== undefined && compareVersions(highest, MIN_VERSION) < 0,
  };
}

/** The projects to look at under `root`: the workspaces with a framework or argus/table deps, else the root. */
export function projects(root) {
  const dirs = workspaces(root);
  const rootPkg = readJson(join(root, 'package.json'));
  const list = [];
  const rootDeps = dependencies(rootPkg);
  const appLike = (deps) =>
    Object.keys(deps).some((d) =>
      /^(?:react|vue|nuxt|next|svelte|solid-js|@angular\/core|vite|argus-table|@argus-table\/.*|lit)$/.test(
        d,
      ),
    );
  if (
    !dirs.length ||
    appLike(rootDeps) ||
    existsSync(join(root, 'angular.json')) ||
    existsSync(join(root, 'index.html'))
  ) {
    list.push(root);
  }
  for (const dir of dirs) if (dir !== root) list.push(dir);
  return list.length ? list : [root];
}

/** The project a file belongs to: the deepest project folder holding it. */
export function projectOf(file, projectDirs) {
  let best;
  for (const dir of projectDirs) {
    if (file === dir || file.startsWith(dir.endsWith('/') ? dir : `${dir}/`)) {
      if (!best || dir.length > best.length) best = dir;
    }
  }
  return best;
}

/** Where a theme import usually goes, by framework and meta-framework (first existing file). */
export function themeTargets(dir, framework) {
  const candidates = [];
  const meta = framework.meta.name;
  if (meta === 'next') {
    candidates.push(
      ...(framework.meta.appDir
        ? ['tsx', 'jsx', 'js', 'ts'].map((e) => `${framework.meta.appDir}/layout.${e}`)
        : []),
      ...(framework.meta.pagesDir
        ? ['tsx', 'jsx', 'js', 'ts'].map((e) => `${framework.meta.pagesDir}/_app.${e}`)
        : []),
    );
  } else if (meta === 'remix' || meta === 'react-router') {
    candidates.push('app/root.tsx', 'app/root.jsx');
  } else if (meta === 'nuxt') {
    candidates.push('nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs');
  } else if (framework.name === 'angular') {
    const angular = readJson(join(dir, 'angular.json'));
    const projectsList = Object.values(angular?.projects ?? {});
    for (const p of projectsList) {
      const styles = p?.architect?.build?.options?.styles ?? p?.targets?.build?.options?.styles;
      for (const s of styles ?? []) {
        const path = typeof s === 'string' ? s : s?.input;
        if (path && !path.includes('node_modules') && !path.startsWith('@')) candidates.push(path);
      }
    }
    candidates.push('src/styles.css', 'src/styles.scss');
  } else if (meta === 'sveltekit') {
    candidates.push('src/routes/+layout.svelte');
  } else if (meta === 'astro') {
    candidates.push('src/layouts/Layout.astro');
  }
  candidates.push(
    'src/main.tsx',
    'src/main.ts',
    'src/main.jsx',
    'src/main.js',
    'src/index.tsx',
    'src/index.ts',
    'src/index.jsx',
    'src/index.js',
    'main.js',
    'main.ts',
    'index.html',
  );
  return candidates.filter((c) => existsSync(join(dir, c)));
}
