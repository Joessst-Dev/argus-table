// check.mjs: every rule on fixtures written to break it (and nothing else),
// the starters and the references' full examples passing clean, and its
// options, suppression comments and exit codes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { node, nodeJson, project, repo, scripts } from './integrate-helpers.mjs';

const findings = async (dir, ...args) =>
  (await nodeJson('check.mjs', [dir, '--json', ...args])).findings;
const ids = (list) => list.map((f) => `${f.rule}@${f.file}:${String(f.line ?? '')}`).sort();

describe('check.mjs', () => {
  it('finds what is wrong with a React table, and only that', async () => {
    const found = await findings(project('check-bad-react'));
    assert.deepEqual(ids(found), [
      'addon-not-installed@src/Orders.tsx:4',
      'addon-unused@package.json:5',
      'controlled-without-handler@src/Orders.tsx:32',
      'data-mutated@src/Orders.tsx:22',
      'leftover-library@src/Orders.tsx:5',
      'missing-label@src/Orders.tsx:28',
      'no-theme@src/Orders.tsx:2',
      'plugin-order@src/Orders.tsx:33',
      'raw-element@src/Orders.tsx:37',
      'selection-without-row-id@src/Orders.tsx:31',
      'set-filter-needs-options@src/Orders.tsx:48',
      'sortable-never-set@src/Orders.tsx:16',
      'unknown-column-field@src/Orders.tsx:17',
      'unknown-column-field@src/Orders.tsx:17',
      'unknown-event@src/Orders.tsx:35',
      'unknown-prop@src/Orders.tsx:34',
      'unstable-identity@src/Orders.tsx:16',
      'unstable-identity@src/Orders.tsx:33',
      'unstable-identity@src/Orders.tsx:47',
      'unstable-identity@src/Orders.tsx:48',
      'versions-mixed@package.json:7',
    ]);
    const severity = (rule) => found.find((f) => f.rule === rule)?.severity;
    assert.equal(severity('raw-element'), 'error'); // React 18 sets attributes
    assert.equal(severity('versions-mixed'), 'warn'); // ranges only, nothing installed
    assert.equal(severity('sortable-never-set'), 'info');
    const event = found.find((f) => f.rule === 'unknown-event');
    assert.match(event.fix, /renamed: onSortingChange \(argus-sorting-change\)/);
    const fields = found.filter((f) => f.rule === 'unknown-column-field').map((f) => f.message);
    assert.deepEqual(fields, [
      "Column field field isn't part of a ColumnDef; it's accessor here.",
      "Column field headerName isn't part of a ColumnDef; it's header here.",
    ]);
  });

  it('finds functions passed from a Next.js Server Component', async () => {
    const found = await findings(project('check-bad-next'));
    assert.deepEqual(ids(found), ['server-component-props@app/page.tsx:12']);
    assert.match(found[0].message, /columns with functions, getRowId, onRowClick/);
    assert.equal(found[0].severity, 'error');
    assert.deepEqual(await findings(project('check-good-next')), []);
  });

  it('finds what is wrong in Vue, Angular and plain HTML', async () => {
    assert.deepEqual(ids(await findings(project('check-bad-vue'))), [
      'attribute-for-property@src/App.vue:18',
      'controlled-without-handler@src/App.vue:15',
      'multiple-themes@package.json:',
      'raw-element@src/App.vue:19',
      'unknown-event@src/App.vue:16',
      'unstable-identity@src/App.vue:13',
      'wrapper-mismatch@package.json:5',
    ]);
    assert.deepEqual(ids(await findings(project('check-bad-angular'))), [
      'controlled-without-handler@src/app/raw.component.ts:14',
      'raw-element@src/app/raw.component.ts:9',
      'unknown-event@src/app/raw.component.ts:15',
      'unstable-identity@src/app/raw.component.ts:13',
    ]);
    assert.deepEqual(ids(await findings(project('check-bad-html'))), [
      'attribute-for-property@main.js:4',
      'cdn-and-bundle@index.html:4',
      'controlled-without-handler@main.js:11',
      'missing-label@index.html:7',
      'no-theme@index.html:4',
      'selection-without-row-id@main.js:10',
      'sortable-never-set@main.js:5',
      'unknown-column-field@main.js:7',
      'unknown-event@main.js:12',
    ]);
  });

  it('passes the starters', async () => {
    for (const starter of ['html', 'react', 'vue', 'angular']) {
      const dir = project(undefined);
      // The starters without their node_modules: versions come from their ranges.
      const { cpSync } = await import('node:fs');
      cpSync(join(repo, 'apps/examples', starter), dir, {
        recursive: true,
        filter: (src) => !src.includes('node_modules'),
      });
      const found = await findings(dir);
      const unexpected = found.filter((f) => f.rule !== 'version-below-minimum');
      assert.deepEqual(unexpected, [], starter);
    }
  });

  it('passes the references’ full examples', async () => {
    const deps = {
      argus: {
        'argus-table': '^1.1.0',
        '@argus-table/themes': '^1.1.0',
        '@argus-table/header-menu': '^1.1.0',
      },
    };
    const examples = {
      react: {
        deps: { react: '^19.1.0', 'react-dom': '^19.1.0', '@argus-table/react': '^1.1.0' },
        theme: ['src/main.tsx', "import '@argus-table/themes/default.css';\n"],
      },
      vue: {
        deps: { vue: '^3.5.0', '@argus-table/vue': '^1.1.0' },
        theme: ['src/main.ts', "import '@argus-table/themes/default.css';\n"],
      },
      angular: {
        deps: { '@angular/core': '^20.1.0', '@argus-table/angular': '^1.1.0' },
        theme: ['src/styles.css', "@import '@argus-table/themes/default.css';\n"],
      },
      vanilla: { deps: {}, theme: null },
    };
    for (const [framework, { deps: own, theme }] of Object.entries(examples)) {
      const doc = readFileSync(
        join(scripts, '..', 'references', 'frameworks', `${framework}.md`),
        'utf8',
      );
      const section = doc.slice(doc.indexOf('## Full example'));
      const files = {
        'package.json': { name: framework, private: true, dependencies: { ...deps.argus, ...own } },
      };
      for (const m of section.matchAll(/^```\w+ file=(\S+)\n([\s\S]*?)^```/gm)) files[m[1]] = m[2];
      assert.ok(Object.keys(files).length > 1, `${framework}.md has a full example`);
      if (theme) files[theme[0]] = theme[1];
      assert.deepEqual(await findings(project(undefined, files)), [], framework);
    }
  });

  it('honours suppression comments, --only, --ignore, --from and --strict', async () => {
    const dir = project('check-bad-react');
    const file = join(dir, 'src/Orders.tsx');
    const source = readFileSync(file, 'utf8')
      .replace(
        '    rows.push(order);',
        '    // argus-check-ignore-next-line data-mutated\n    rows.push(order);',
      )
      .replace(
        "import { AgGridReact } from 'ag-grid-react';",
        "import { AgGridReact } from 'ag-grid-react'; // argus-check-ignore leftover-library",
      );
    writeFileSync(file, source);
    const rules = (await findings(dir)).map((f) => f.rule);
    assert.ok(!rules.includes('data-mutated'));
    assert.ok(!rules.includes('leftover-library'));
    assert.ok(rules.includes('raw-element'));

    assert.deepEqual(ids(await findings(dir, '--only', 'plugin-order')), [
      'plugin-order@src/Orders.tsx:34',
    ]);
    assert.ok(
      !(await findings(dir, '--ignore', 'unstable-identity,missing-label')).some((f) =>
        ['unstable-identity', 'missing-label'].includes(f.rule),
      ),
    );
    const sortable = (await findings(dir, '--from', 'ag-grid')).find(
      (f) => f.rule === 'sortable-never-set',
    );
    assert.equal(sortable.severity, 'warn');
    assert.match(sortable.message, /AG Grid sorted every column by default/);

    const good = project('check-good-next');
    assert.equal((await node('check.mjs', [good])).code, 0);
    assert.equal((await node('check.mjs', [project('check-bad-next')])).code, 1);
    const warnOnly = project('check-bad-angular');
    writeFileSync(
      join(warnOnly, 'src/app/raw.component.ts'),
      readFileSync(join(warnOnly, 'src/app/raw.component.ts'), 'utf8').replace(
        '(rowClicked)',
        '(rowClick)',
      ),
    );
    assert.equal((await node('check.mjs', [warnOnly])).code, 0);
    assert.equal((await node('check.mjs', [warnOnly, '--strict'])).code, 1);
    assert.equal((await node('check.mjs', ['--only', 'nope'])).code, 2);
    assert.equal((await node('check.mjs', ['--from', 'nope'])).code, 2);
  });

  it('reports the old library left in the files of a migrated usage', async () => {
    const dir = project('next-app-aggrid');
    const scan = await nodeJson('scan.mjs', [dir]);
    const scanFile = join(dir, '..', `${String(Date.now())}-scan.json`);
    writeFileSync(scanFile, JSON.stringify(scan));
    // Half-way through: argus-table is installed and used next to the old grid.
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    pkg.dependencies['@argus-table/react'] = '^1.1.0';
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    writeFileSync(
      join(dir, 'app/orders/new-grid.tsx'),
      "'use client';\nimport { ArgusTable } from '@argus-table/react';\nexport function Grid() {\n  return <ArgusTable aria-label=\"Orders\" />;\n}\n",
    );
    const found = await findings(dir, '--scan', scanFile);
    const leftovers = ids(found.filter((f) => f.rule === 'leftover-library'));
    assert.deepEqual(leftovers, [
      'leftover-library@app/orders/columns.ts:1',
      'leftover-library@app/orders/orders-grid.tsx:4',
      'leftover-library@app/orders/orders-grid.tsx:5',
    ]);
    assert.equal(
      found.find((f) => f.rule === 'sortable-never-set'),
      undefined,
    ); // no columns traced in new-grid
  });
});
