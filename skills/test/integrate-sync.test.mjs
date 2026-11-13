// The argus-table-integrate skill describes argus-table's API without
// importing it. These tests keep its facts (scripts/lib/api.mjs), its
// catalog of other tables (scripts/lib/libraries.mjs) and its references in
// step with the packages: the Custom Elements Manifest (built by
// `nx build argus-table`), the core types, the generated wrappers, the
// themes and add-ons, and the changesets' release group.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as api from '../argus-table-integrate/scripts/lib/api.mjs';
import { GAPS, LIBRARIES } from '../argus-table-integrate/scripts/lib/libraries.mjs';
import { ADDON_IMPORTS, IMPORTS } from '../argus-table-integrate/scripts/lib/templates.mjs';
import { RULES } from '../argus-table-integrate/scripts/check.mjs';
import { findTags } from '../argus-table-integrate/scripts/lib/markup.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const skill = resolve(here, '..', 'argus-table-integrate');
const text = (path) => readFileSync(join(repo, path), 'utf8');
const json = (path) => JSON.parse(text(path));
const sorted = (list) => [...new Set(list)].sort();

function manifest() {
  const path = join(repo, 'packages/table/dist/custom-elements.json');
  assert.ok(
    existsSync(path),
    'packages/table/dist/custom-elements.json is missing: run `pnpm nx build argus-table` (nx test skills does).',
  );
  const declarations = JSON.parse(readFileSync(path, 'utf8')).modules.flatMap(
    (m) => m.declarations ?? [],
  );
  const element = (tag) => {
    const d = declarations.find((x) => x.tagName === tag);
    assert.ok(d, `${tag} is not in the manifest`);
    const members = (d.members ?? []).filter(
      (m) => !m.privacy && !m.static && !m.name.startsWith('#'),
    );
    return {
      fields: members.filter((m) => m.kind === 'field'),
      methods: members.filter((m) => m.kind === 'method').map((m) => m.name),
      events: (d.events ?? []).map((e) => e.name),
      attributes: (d.attributes ?? []).map((a) => a.name),
    };
  };
  return {
    table: element('argus-table'),
    column: element('argus-column'),
    group: element('argus-column-group'),
  };
}

/** Member names of an exported interface in a TypeScript file (top level of its body). */
function interfaceMembers(source, name) {
  const start = source.search(new RegExp(`export interface ${name}\\b`));
  assert.notEqual(start, -1, `interface ${name} not found`);
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = source.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, '');
  const names = [];
  let level = 0;
  for (const line of body.split('\n')) {
    const m = level === 0 ? /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*[:(]/.exec(line) : null;
    if (m) names.push(m[1]);
    for (const c of line.replace(/\/\/.*$|\/\*.*?\*\//g, '')) {
      if (c === '{' || c === '(' || c === '[') level++;
      else if (c === '}' || c === ')' || c === ']') level--;
    }
  }
  return names;
}

/** Names a module exports, following `export *` and re-exports within the repo. */
function exportsOf(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const names = new Set();
  const source = readFileSync(file, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
  const target = (spec) => {
    if (spec === '@argus-table/core') return join(repo, 'packages/core/src/index.ts');
    if (!spec.startsWith('.')) return undefined;
    const base = resolve(dirname(file), spec.replace(/\.js$/, ''));
    return ['.ts', '/index.ts'].map((e) => base + e).find((p) => existsSync(p));
  };
  for (const m of source.matchAll(/export\s+(?:type\s+)?\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const t = target(m[1]);
    if (t) for (const n of exportsOf(t, seen)) names.add(n);
  }
  for (const m of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  for (const m of source.matchAll(
    /export\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1]);
  }
  return names;
}

const PACKAGE_DIRS = {
  'argus-table': 'packages/table',
  '@argus-table/react': 'packages/react',
  '@argus-table/vue': 'packages/vue',
  '@argus-table/angular': 'packages/angular',
  '@argus-table/header-menu': 'packages/header-menu',
  '@argus-table/formulas': 'packages/formulas',
  '@argus-table/export': 'packages/export',
  '@argus-table/themes': 'packages/themes',
};

/** Every markdown file of the skill, with its fenced code blocks. */
function docs() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.md')) files.push(path);
    }
  };
  walk(skill);
  return files.map((path) => {
    const source = readFileSync(path, 'utf8');
    const blocks = [...source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)].map((m) => ({
      info: m[1].trim(),
      code: m[2],
    }));
    return { path, rel: relative(skill, path), source, blocks };
  });
}

/** The first-column names of the markdown table under a `## heading`. */
function tableNames(source, heading) {
  const start = source.indexOf(`\n## ${heading}\n`);
  assert.notEqual(start, -1, `## ${heading} missing`);
  const end = source.indexOf('\n## ', start + 4);
  const section = source.slice(start, end === -1 ? undefined : end);
  return section
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) => /^\| `([^`(]+)/.exec(l)?.[1]?.trim())
    .filter(Boolean);
}

describe('api.mjs', () => {
  const cem = manifest();

  it('lists the element’s properties, attributes, methods and events', () => {
    const fields = cem.table.fields;
    assert.deepEqual(
      sorted([...Object.keys(api.PROPERTIES), ...api.INTERNAL_PROPERTIES]),
      sorted(fields.map((f) => f.name)),
    );
    for (const f of fields) {
      if (api.INTERNAL_PROPERTIES.includes(f.name)) continue;
      assert.equal(api.PROPERTIES[f.name], f.attribute ?? null, `attribute of ${f.name}`);
    }
    assert.deepEqual(sorted(api.METHODS), sorted(cem.table.methods));
    assert.deepEqual(sorted(api.EVENTS), sorted(cem.table.events));
    assert.deepEqual(sorted(api.COLUMN_ATTRIBUTES), sorted(cem.column.attributes));
    assert.deepEqual(sorted(api.COLUMN_GROUP_ATTRIBUTES), sorted(cem.group.attributes));
  });

  it('lists the add-ons’ events', () => {
    const source = text('tools/generate-wrappers/src/addon-events.ts');
    assert.deepEqual(
      sorted(api.ADDON_EVENTS),
      sorted([...source.matchAll(/\bname:\s*['"](argus-[\w-]+)['"]/g)].map((m) => m[1])),
    );
  });

  it('knows the controllable properties and every wrapper’s binding names', () => {
    const controllable = Object.keys(api.PROPERTIES).filter((p) =>
      api.EVENTS.includes(`argus-${api.kebab(p)}-change`),
    );
    assert.deepEqual(sorted(api.CONTROLLABLES), sorted(controllable));
    const react = text('packages/react/src/generated/elements.ts');
    const vue = text('packages/vue/src/generated/elements.ts');
    const angular = text('packages/angular/src/generated/elements.ts');
    for (const event of [...api.EVENTS, ...api.ADDON_EVENTS]) {
      const b = api.eventBindings(event);
      assert.match(react, new RegExp(`\\b${b.react}\\?:`), `React ${b.react}`);
      assert.match(vue, new RegExp(`emit: '${b.vue}'`), `Vue ${b.vue}`);
      assert.match(
        angular,
        new RegExp(`readonly ${b.angular} = new EventEmitter`),
        `Angular ${b.angular}`,
      );
    }
    for (const p of api.CONTROLLABLES) {
      const b = api.twoWayBindings(p);
      assert.match(vue, new RegExp(`'${b.vue.update}'`), `Vue ${b.vue.update}`);
      assert.match(
        angular,
        new RegExp(`readonly ${b.angular.output} = new EventEmitter`),
        `Angular ${b.angular.output}`,
      );
    }
  });

  it('lists the ColumnDef and ColumnGroup fields', () => {
    const types = text('packages/core/src/types.ts');
    assert.deepEqual(sorted(api.COLUMN_FIELDS), sorted(interfaceMembers(types, 'ColumnDef')));
    assert.deepEqual(
      sorted(api.COLUMN_GROUP_FIELDS),
      sorted(interfaceMembers(types, 'ColumnGroup')),
    );
    for (const old of Object.keys(api.COLUMN_FIELD_RENAMES))
      assert.ok(!api.COLUMN_FIELDS.includes(old), `${old} is a real field`);
  });

  it('names the old events and their replacements', () => {
    for (const [old, now] of Object.entries(api.RENAMED_EVENTS)) {
      assert.ok(!api.EVENTS.includes(old), old);
      assert.ok(api.EVENTS.includes(now), now);
    }
  });

  it('knows the packages, their peers, the themes and the add-ons', () => {
    const fixed = json('.changeset/config.json').fixed[0];
    assert.deepEqual(sorted(api.PACKAGES), sorted(fixed));
    for (const [framework, wrapper] of Object.entries(api.WRAPPERS)) {
      const pkg = json(`${PACKAGE_DIRS[wrapper]}/package.json`);
      assert.equal(pkg.name, wrapper);
      assert.ok('argus-table' in pkg.dependencies, `${wrapper} depends on argus-table`);
      const peer = api.FRAMEWORK_PEERS[framework];
      assert.equal(pkg.peerDependencies[peer.package], peer.range, `${wrapper} peer range`);
    }
    const themes = Object.keys(json('packages/themes/package.json').exports)
      .filter((k) => k.endsWith('.css'))
      .map((k) => k.replace(/^\.\/|\.css$/g, ''));
    assert.deepEqual(sorted(api.THEMES), sorted(themes));
    for (const [name, addon] of Object.entries(api.ADDONS)) {
      const pkg = json(`${PACKAGE_DIRS[name]}/package.json`);
      assert.deepEqual(
        sorted(addon.peers),
        sorted(Object.keys(pkg.peerDependencies)),
        `${name} peers`,
      );
      const exported = exportsOf(join(repo, PACKAGE_DIRS[name], 'src/index.ts'));
      for (const e of addon.exports) assert.ok(exported.has(e), `${name} exports ${e}`);
      assert.ok(addon.exports.includes(addon.factory));
      assert.ok(api.PLUGIN_ORDER.includes(addon.factory));
    }
    const menu = text('packages/header-menu/src/header-menu.ts');
    assert.deepEqual(
      sorted(api.ADDONS['@argus-table/header-menu'].options),
      sorted(interfaceMembers(menu, 'HeaderMenuOptions')),
    );
    const formulas = text('packages/formulas/src/plugin.ts');
    assert.deepEqual(
      sorted(api.ADDONS['@argus-table/formulas'].options),
      sorted(interfaceMembers(formulas, 'FormulasOptions')),
    );
    // TableExportOptions extends ExportOptions = CollectOptions & CsvOptions & XlsxOptions & PdfOptions.
    const exportOptions = [
      ['plugin.ts', 'TableExportOptions'],
      ['collect.ts', 'CollectOptions'],
      ['csv.ts', 'CsvOptions'],
      ['xlsx/xlsx.ts', 'XlsxOptions'],
      ['pdf/pdf.ts', 'PdfOptions'],
    ].flatMap(([file, name]) => interfaceMembers(text(`packages/export/src/${file}`), name));
    assert.match(
      text('packages/export/src/plugin.ts'),
      /type ExportOptions<T = unknown> = CollectOptions<T> & CsvOptions & XlsxOptions & PdfOptions;/,
    );
    assert.deepEqual(sorted(api.ADDONS['@argus-table/export'].options), sorted(exportOptions));
  });

  it('targets a released or upcoming version of the same major', () => {
    const version = json('packages/table/package.json').version;
    assert.ok(
      api.compareVersions(api.MIN_VERSION, version) <= 0 || version.startsWith('1.0.'),
      `MIN_VERSION ${api.MIN_VERSION} > ${version}`,
    );
    assert.equal(api.MIN_VERSION.split('.')[0], version.split('.')[0]);
  });

  it('compares versions and reads ranges', () => {
    assert.equal(api.compareVersions('1.1.0', '1.0.9'), 1);
    assert.equal(api.compareVersions('1.1.0-rc.1', '1.1.0'), -1);
    assert.equal(api.minVersion('^1.2.3'), '1.2.3');
    assert.equal(api.minVersion('~1.2'), '1.2.0');
    assert.equal(api.minVersion('workspace:^'), undefined);
    assert.equal(api.minVersion('latest'), undefined);
  });
});

describe('libraries.mjs', () => {
  it('names only real API in its mappings', () => {
    for (const library of LIBRARIES) {
      const ids = library.features.map((f) => f.id);
      assert.equal(new Set(ids).size, ids.length, `${library.id} has duplicate feature ids`);
      for (const f of library.features) {
        const where = `${library.id}/${f.id}`;
        assert.ok(['maps', 'partial', 'builtin', 'gap'].includes(f.fit), where);
        for (const p of f.argus.props ?? [])
          assert.ok(p in api.PROPERTIES, `${where}: property ${p}`);
        for (const c of f.argus.column ?? [])
          assert.ok(api.COLUMN_FIELDS.includes(c), `${where}: column field ${c}`);
        for (const e of f.argus.events ?? [])
          assert.ok(api.EVENTS.includes(e), `${where}: event ${e}`);
        for (const m of f.argus.methods ?? [])
          assert.ok(api.METHODS.includes(m), `${where}: method ${m}`);
        for (const a of f.argus.addons ?? []) assert.ok(a in api.ADDONS, `${where}: add-on ${a}`);
        if (f.fit === 'gap') assert.ok(GAPS.includes(f.gap), `${where}: gap ${String(f.gap)}`);
        else assert.equal(f.gap, undefined, where);
      }
      assert.ok(existsSync(join(skill, 'references', library.reference)), library.reference);
    }
  });
});

describe('the references', () => {
  const all = docs();
  const byRel = new Map(all.map((d) => [d.rel, d]));
  const headings = (source) => [...source.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1]));
  const slug = (heading) =>
    heading
      .trim()
      .toLowerCase()
      .replace(/[`*]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

  it('has SKILL.md frontmatter the skill tools accept', () => {
    const source = byRel.get('SKILL.md').source;
    const front = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
    assert.match(front, /^name: argus-table-integrate$/m);
    const description = /^description: (.*)$/m.exec(front)?.[1] ?? '';
    assert.ok(
      description.length > 100 && description.length <= 1024,
      `description is ${String(description.length)} characters`,
    );
    assert.ok(source.split('\n').length < 300, 'SKILL.md stays short');
    const marketplace = json('.claude-plugin/marketplace.json');
    assert.ok(marketplace.plugins[0].skills.includes('./skills/argus-table-integrate'));
  });

  it('links to files and headings that exist', () => {
    for (const doc of all) {
      for (const m of doc.source.matchAll(/\]\(([^)\s]+)\)/g)) {
        const link = m[1];
        if (/^https?:|^mailto:/.test(link)) continue;
        const [file, anchor] = link.split('#');
        const target = file ? resolve(dirname(doc.path), file) : doc.path;
        assert.ok(existsSync(target), `${doc.rel}: ${link}`);
        if (anchor)
          assert.ok(
            headings(readFileSync(target, 'utf8')).includes(anchor),
            `${doc.rel}: #${anchor} in ${file || doc.rel}`,
          );
      }
    }
  });

  it('import only what the packages export', () => {
    const exported = new Map();
    const exportsOfPackage = (name) => {
      if (!exported.has(name))
        exported.set(name, exportsOf(join(repo, PACKAGE_DIRS[name], 'src/index.ts')));
      return exported.get(name);
    };
    const snippets = [
      ...all.flatMap((d) => d.blocks.map((b) => ({ where: d.rel, code: b.code }))),
      ...Object.values(IMPORTS)
        .flat()
        .map((code) => ({ where: 'templates.mjs', code })),
      ...Object.values(ADDON_IMPORTS).map((code) => ({ where: 'templates.mjs', code })),
    ];
    let checked = 0;
    for (const { where, code } of snippets) {
      for (const m of code.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]((?:argus-table|@argus-table\/[\w-]+))['"]/g,
      )) {
        const pkg = m[2];
        assert.ok(pkg in PACKAGE_DIRS, `${where}: unknown package ${pkg}`);
        for (const part of m[1].split(',')) {
          const name = part
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0]
            ?.trim();
          if (!name) continue;
          assert.ok(exportsOfPackage(pkg).has(name), `${where}: ${pkg} doesn't export ${name}`);
          checked++;
        }
      }
      for (const m of code.matchAll(/@argus-table\/themes(?:@[\w.^~]+)?(?:\/dist)?\/(\w+)\.css/g)) {
        assert.ok(api.THEMES.includes(m[1]), `${where}: theme ${m[1]}`);
      }
    }
    assert.ok(checked > 30, `only ${String(checked)} imports checked`);
  });

  it('bind only real properties and events on tables in their examples', () => {
    const events = new Set(
      [...api.EVENTS, ...api.ADDON_EVENTS].flatMap((e) =>
        Object.values(api.eventBindings(e)).concat(e),
      ),
    );
    for (const p of api.CONTROLLABLES) events.add(`update:${p}`);
    // `…` stands for "the other props" in short examples.
    const allowed =
      /^(?:aria-[\w-]+|ref|style|class|className|id|key|slot|v-model|#\w+|\{\.\.\.\}|…)$/;
    const dom = new Set(['click', 'onClick', 'input', 'dblclick', 'keydown']);
    for (const doc of all) {
      for (const block of doc.blocks) {
        for (const tag of [
          ...findTags(block.code, 'ArgusTable'),
          ...findTags(block.code, 'argus-table'),
        ]) {
          for (const attr of tag.attrs) {
            const plain = attr.kind === 'static' && /^(?:aria|data)-/.test(attr.name);
            const name =
              attr.name.includes('-') &&
              !plain &&
              !attr.name.startsWith('aria-') &&
              attr.kind !== 'event'
                ? api.camel(attr.name)
                : attr.name;
            if (attr.kind === 'event') {
              assert.ok(events.has(name) || dom.has(name), `${doc.rel}: event ${attr.name}`);
            } else if (attr.kind !== 'spread' && attr.kind !== 'directive') {
              assert.ok(
                name in api.PROPERTIES || allowed.test(attr.name),
                `${doc.rel}: ${attr.name} on a table`,
              );
            }
          }
        }
      }
    }
  });

  it('list exactly the API in api.md', () => {
    const source = byRel.get('references/api.md').source;
    assert.deepEqual(sorted(tableNames(source, 'Properties')), sorted(Object.keys(api.PROPERTIES)));
    assert.deepEqual(sorted(tableNames(source, 'Events')), sorted(api.EVENTS));
    assert.deepEqual(sorted(tableNames(source, 'Methods')), sorted(api.METHODS));
    assert.deepEqual(sorted(tableNames(source, 'ColumnDef')), sorted(api.COLUMN_FIELDS));
    assert.deepEqual(sorted(tableNames(source, 'ColumnGroup')), sorted(api.COLUMN_GROUP_FIELDS));
    for (const event of api.EVENTS) {
      const row = source.split('\n').find((l) => l.startsWith(`| \`${event}\``)) ?? '';
      const b = api.eventBindings(event);
      for (const name of [b.react, b.vue, b.angular])
        assert.ok(row.includes(`\`${name}\``), `api.md: ${event} → ${name}`);
    }
  });

  it('have a pitfalls section per check rule, and a gaps section per gap', () => {
    const pitfalls = byRel.get('references/pitfalls.md').source;
    assert.deepEqual(
      sorted([...pitfalls.matchAll(/^## (.+)$/gm)].map((m) => m[1])),
      sorted(Object.keys(RULES)),
    );
    const gaps = byRel.get('references/gaps.md').source;
    assert.deepEqual(sorted([...gaps.matchAll(/^## (.+)$/gm)].map((m) => m[1])), sorted(GAPS));
  });

  it('have a migration guide per library, with its features and their fit', () => {
    const required = [
      'Detect',
      'Concepts',
      'Columns',
      'State and events',
      'Example',
      'Gaps',
      'Remove',
      'Behaviour differences',
    ];
    for (const library of LIBRARIES) {
      const doc = byRel.get(`references/${library.reference}`);
      assert.ok(doc, library.reference);
      const sections = [...doc.source.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      assert.deepEqual(sections, required, `${library.reference} sections`);
      const concepts = doc.source.slice(
        doc.source.indexOf('\n## Concepts\n'),
        doc.source.indexOf('\n## Columns\n'),
      );
      const rows = concepts.split('\n').filter((l) => /^\| `[\w-]+` +\|/.test(l));
      const table = new Map(
        rows.map((l) => {
          const cells = l.split('|').map((c) => c.trim());
          return [cells[1].replace(/`/g, ''), cells[4]];
        }),
      );
      assert.deepEqual(
        sorted(table.keys()),
        sorted(library.features.map((f) => f.id)),
        `${library.reference} feature ids`,
      );
      for (const f of library.features)
        assert.equal(table.get(f.id), f.fit, `${library.reference}: ${f.id}`);
    }
  });
});

describe('the scripts', () => {
  it('run on Node 18', () => {
    const banned = [
      /import\.meta\.(?:dirname|filename)/,
      /\bfs\.glob\b|\bglobSync\b/,
      /\bObject\.groupBy\b|\bMap\.groupBy\b/,
      /\bPromise\.withResolvers\b/,
      /\.toSorted\(|\.toReversed\(|\.toSpliced\(|\.with\(/,
      /\bArray\.fromAsync\b/,
      /\bprocess\.loadEnvFile\b|\bRegExp\.escape\b/,
    ];
    const scripts = join(skill, 'scripts');
    const files = [
      ...readdirSync(scripts).map((f) => join(scripts, f)),
      ...readdirSync(join(scripts, 'lib')).map((f) => join(scripts, 'lib', f)),
    ].filter((f) => f.endsWith('.mjs'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const re of banned)
        assert.doesNotMatch(source, re, `${relative(skill, file)} uses ${re.source}`);
    }
  });
});
