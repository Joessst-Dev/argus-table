// scan.mjs on fixture projects: which tables it finds, where, with which
// features and what they become; and its handling of workspaces, ignored
// folders and limits.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { installed, node, nodeJson, project } from './integrate-helpers.mjs';

const scan = (dir, ...args) => nodeJson('scan.mjs', [dir, ...args]);
const feature = (usage, id) => usage.features.find((f) => f.id === id);

describe('scan.mjs', () => {
  it('finds a shared TanStack data table, its call sites and column files', async () => {
    const dir = project('react-vite-tanstack', {
      ...installed({ '@tanstack/react-table': '8.21.3', react: '19.1.0' }),
      // Decoys: anchors in node_modules and build output are never usages.
      'node_modules/@tanstack/react-table/build/index.js':
        'export function useReactTable() {}\nuseReactTable({});',
      'dist/assets/index.js': 'useReactTable({ getPaginationRowModel })',
    });
    const report = await scan(dir);
    const [p] = report.projects;
    assert.equal(p.framework.name, 'react');
    assert.equal(p.framework.version, '19.1.0');
    assert.equal(p.meta.name, 'vite');
    assert.deepEqual(
      p.tableLibraries.map((l) => [l.id, l.version]),
      [['tanstack', '8.21.3']],
    );
    assert.equal(report.usages.length, 2);

    const [shared, direct] = report.usages;
    assert.equal(shared.file, 'src/components/ui/data-table.tsx');
    assert.equal(shared.line, 23);
    assert.equal(shared.kind, 'shared-component');
    assert.deepEqual(shared.scope.callSites, ['src/app/payments/page.tsx']);
    assert.ok(shared.scope.files.includes('src/app/payments/columns.tsx'));
    assert.deepEqual(feature(shared, 'pagination'), {
      id: 'pagination',
      fit: 'gap',
      argus: null,
      at: ['src/components/ui/data-table.tsx:27', 'src/components/ui/data-table.tsx:59'],
      evidence: 'getPaginationRowModel',
      ref: 'gaps.md#pagination',
      gap: 'pagination',
    });
    assert.equal(feature(shared, 'sorting').fit, 'maps');
    assert.equal(feature(shared, 'row-selection').fit, 'maps');
    assert.deepEqual(shared.summary.gaps, ['pagination']);

    assert.equal(direct.file, 'src/orders/OrdersTable.tsx');
    assert.equal(direct.kind, 'direct');
    assert.deepEqual(feature(direct, 'row-id').at, ['src/orders/OrdersTable.tsx:25']);
    assert.equal(feature(direct, 'virtualizer').fit, 'builtin');
    assert.deepEqual(direct.summary.hardGaps, ['row-grouping', 'tree-data']);
    assert.equal(direct.summary.effort, 'high');
    // The <table> TanStack renders isn't a plain table of its own.
    assert.ok(!report.usages.some((u) => u.library === 'html-table'));
  });

  it('reads an AG Grid Enterprise screen in a Next.js App Router app', async () => {
    const report = await scan(project('next-app-aggrid'));
    const [p] = report.projects;
    assert.equal(report.packageManager.name, 'pnpm');
    assert.deepEqual([p.meta.name, p.meta.rsc, p.meta.appDir], ['next', true, 'app']);
    assert.equal(p.themeTargets[0], 'app/layout.tsx');
    assert.deepEqual(
      p.tableLibraries.map((l) => [l.id, l.edition]),
      [['ag-grid', 'enterprise']],
    );
    assert.equal(report.usages.length, 1);
    const [u] = report.usages;
    assert.equal(u.file, 'app/orders/orders-grid.tsx');
    assert.equal(u.kind, 'direct');
    assert.equal(u.clientDirective, true);
    assert.ok(u.scope.files.includes('app/orders/columns.ts'));
    assert.equal(feature(u, 'sorting').fit, 'maps');
    assert.equal(feature(u, 'server-side-row-model').fit, 'partial');
    assert.deepEqual(feature(u, 'editing').at, ['app/orders/columns.ts:15']);
    assert.deepEqual(u.summary.gaps, ['pagination', 'editing', 'row-grouping', 'tool-panels']);
    assert.deepEqual(u.summary.hardGaps, ['editing', 'row-grouping']);
  });

  it('reads MUI X with server-side paging', async () => {
    const report = await scan(project('mui-datagrid-pro'));
    assert.equal(report.packageManager.name, 'yarn');
    assert.equal(report.projects[0].tableLibraries[0].edition, 'pro');
    const [u] = report.usages;
    assert.equal(u.file, 'src/Users.tsx');
    assert.equal(feature(u, 'server-mode').fit, 'maps');
    assert.equal(feature(u, 'detail-panel').gap, 'master-detail');
    assert.equal(feature(u, 'density').fit, 'maps');
    assert.equal(feature(u, 'column-types').fit, 'maps');
  });

  it('tells Vue kits apart', async () => {
    const report = await scan(project('vue-kits'));
    assert.deepEqual(
      report.usages.map((u) => [u.library, u.file]),
      [
        ['primeng', 'src/components/Products.vue'],
        ['vuetify', 'src/components/ServerTable.vue'],
        ['element-plus', 'src/components/Orders.vue'],
      ],
    );
    const [prime, vuetify, element] = report.usages;
    assert.equal(feature(prime, 'multi-sort').fit, 'partial');
    assert.equal(feature(vuetify, 'server').fit, 'maps');
    assert.equal(feature(vuetify, 'slots').fit, 'maps');
    assert.equal(feature(element, 'pagination').fit, 'gap');
    assert.equal(feature(element, 'selection').fit, 'maps');
  });

  it('follows Angular templateUrl and inline templates', async () => {
    const report = await scan(project('angular-material-primeng'));
    const [p] = report.projects;
    assert.equal(p.framework.name, 'angular');
    assert.equal(p.themeTargets[0], 'src/styles.scss');
    const [material, prime] = report.usages;
    assert.equal(material.file, 'src/app/orders/orders.component.html');
    assert.equal(material.line, 2);
    assert.deepEqual(material.scope.files, ['src/app/orders/orders.component.ts']);
    assert.deepEqual(feature(material, 'filter').at, [
      'src/app/orders/orders.component.ts:26',
      'src/app/orders/orders.component.ts:30',
    ]);
    assert.equal(feature(material, 'paginator').fit, 'gap');
    assert.equal(feature(material, 'sticky').fit, 'maps');
    assert.equal(prime.library, 'primeng');
    assert.equal(prime.file, 'src/app/products/products.component.ts');
    assert.equal(feature(prime, 'lazy').fit, 'maps');
  });

  it('counts only antd’s own Table', async () => {
    const report = await scan(project('antd'));
    assert.deepEqual(
      report.usages.map((u) => u.file),
      ['src/Customers.tsx'],
    );
    const [u] = report.usages;
    assert.equal(feature(u, 'row-key').fit, 'maps');
    assert.equal(feature(u, 'expandable').gap, 'master-detail');
  });

  it('finds plain tables filled by a script, and static ones on request', async () => {
    const dir = project('html-tables');
    const report = await scan(dir);
    assert.deepEqual(
      report.usages.map((u) => u.file),
      ['index.html'],
    );
    const [u] = report.usages;
    assert.deepEqual(u.scope.files, ['main.js']);
    assert.deepEqual(feature(u, 'pagination').at, ['main.js:7']);
    assert.equal(feature(u, 'sorting').fit, 'maps');
    assert.equal(feature(u, 'search').fit, 'partial');
    const all = await scan(dir, '--include-static-tables');
    assert.deepEqual(
      all.usages.map((u) => u.file),
      ['index.html', 'static/about.html'],
    );
  });

  it('reads a pnpm monorepo: workspaces, versions per importer, duplicates', async () => {
    const report = await scan(project('monorepo-pnpm'));
    assert.equal(report.monorepo.tool, 'pnpm');
    assert.deepEqual(
      report.monorepo.workspaces.map((w) => w.path),
      ['apps/admin', 'apps/web'],
    );
    const web = report.projects.find((p) => p.path === 'apps/web');
    assert.equal(web.argus.packages['argus-table'].version, '1.0.0');
    assert.equal(web.argus.packages['@argus-table/react'].version, '1.1.0');
    assert.deepEqual(web.argus.mismatched, ['argus-table@1.0.0', '@argus-table/react@1.1.0']);
    assert.deepEqual(web.argus.duplicates, ['1.0.0', '1.1.0']);
    assert.equal(web.argus.wrapperMatchesFramework, true);
    assert.deepEqual(
      report.usages.map((u) => [u.library, u.project, u.file]),
      [['ag-grid', 'apps/admin', 'apps/admin/src/Grid.vue']],
    );
    assert.deepEqual(
      report.argusUsages.map((a) => a.kind),
      ['import', 'wrapper'],
    );
  });

  it('keeps to its limits and its arguments', async () => {
    const report = await scan(project('react-vite-tanstack'), '--max-files', '3');
    assert.equal(report.truncated, true);
    assert.match(report.warnings[0], /Stopped after 3 files/);
    const only = await scan(project('vue-kits'), '--library', 'vuetify');
    assert.deepEqual(
      only.usages.map((u) => u.library),
      ['vuetify'],
    );
    const summary = await node('scan.mjs', [project('vue-kits'), '--summary']);
    assert.equal(summary.code, 0);
    assert.match(summary.stdout, /Table usages \(3\):/);
    assert.match(summary.stdout, /u2 src\/components\/ServerTable\.vue:19 vuetify/);
    assert.equal((await node('scan.mjs', ['--library', 'nope'])).code, 2);
    assert.equal((await node('scan.mjs', ['--max-files', '0'])).code, 2);
    assert.equal((await node('scan.mjs', [project(undefined)])).code, 1);
  });
});
