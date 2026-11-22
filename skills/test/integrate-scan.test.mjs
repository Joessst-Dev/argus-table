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
    // Grouped rows in memory: grouping and expanding them are partial (grouping, treeExpanded).
    assert.equal(feature(direct, 'grouping').fit, 'partial');
    assert.equal(feature(direct, 'expanding').fit, 'partial');
    assert.deepEqual(direct.summary.hardGaps, []);
    assert.equal(direct.summary.effort, 'medium');
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
    assert.equal(feature(u, 'editing').fit, 'partial');
    // Grouping on the server-side row model: groupKeys become groupPath.
    assert.equal(feature(u, 'row-grouping').fit, 'partial');
    assert.deepEqual(u.summary.gaps, ['pagination', 'tool-panels']);
    assert.deepEqual(u.summary.hardGaps, []);
  });

  it('reads MUI X with server-side paging', async () => {
    const report = await scan(project('mui-datagrid-pro'));
    assert.equal(report.packageManager.name, 'yarn');
    assert.equal(report.projects[0].tableLibraries[0].edition, 'pro');
    const [u] = report.usages;
    assert.equal(u.file, 'src/Users.tsx');
    assert.equal(feature(u, 'server-mode').fit, 'maps');
    assert.equal(feature(u, 'detail-panel').fit, 'partial');
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
    // A lazy p-table isn't a lazy tree.
    assert.equal(feature(prime, 'lazy-tree'), undefined);
  });

  it('counts only antd’s own Table', async () => {
    const report = await scan(project('antd'));
    assert.deepEqual(
      report.usages.map((u) => u.file),
      ['src/Customers.tsx'],
    );
    const [u] = report.usages;
    assert.equal(feature(u, 'row-key').fit, 'maps');
    assert.equal(feature(u, 'expandable').fit, 'partial');
    assert.equal(feature(u, 'tree-data'), undefined);
  });

  it('finds tree rows that come from a children array alone', async () => {
    const antd = await scan(
      project('antd', {
        'src/Folders.tsx': [
          "import { Table, Tree } from 'antd';",
          '',
          'interface Folder {',
          '  key: string;',
          '  name: string;',
          '  children?: Folder[];',
          '}',
          '',
          'export function Folders({ data }: { data: Folder[] }) {',
          '  return (',
          '    <>',
          '      <Tree checkable checkStrictly treeData={[]} />',
          "      <Table<Folder> columns={[{ title: 'Name', dataIndex: 'name' }]} dataSource={data} rowKey=\"key\" rowSelection={{ type: 'checkbox' }} />",
          '    </>',
          '  );',
          '}',
          '',
        ].join('\n'),
      }),
    );
    const folders = antd.usages.find((u) => u.file === 'src/Folders.tsx');
    // The interface marks the tree; <Tree checkStrictly> isn't the table's.
    assert.deepEqual(feature(folders, 'tree-data'), {
      ...feature(folders, 'tree-data'),
      fit: 'maps',
      at: ['src/Folders.tsx:6'],
    });

    const vue = await scan(
      project('vue-kits', {
        'src/components/Folders.vue': [
          '<script setup lang="ts">',
          "const folders = [{ id: '1', name: 'Docs', children: [{ id: '1.1', name: 'a.pdf' }] }];",
          '</script>',
          '',
          '<template>',
          '  <el-table :data="folders" row-key="id" default-expand-all>',
          '    <el-table-column prop="name" label="Name" />',
          '  </el-table>',
          '</template>',
          '',
        ].join('\n'),
      }),
    );
    const element = vue.usages.find((u) => u.file === 'src/components/Folders.vue');
    assert.equal(feature(element, 'tree').fit, 'maps');
    assert.deepEqual(feature(element, 'tree').at, ['src/components/Folders.vue:6']);
    const orders = vue.usages.find((u) => u.file === 'src/components/Orders.vue');
    assert.equal(feature(orders, 'tree'), undefined);
  });

  it('reads Element Plus lazy tree tables, not a lazy el-tree next to a flat table', async () => {
    const report = await scan(
      project('vue-kits', {
        'src/components/Lazy.vue': [
          '<template>',
          '  <el-table',
          '    :data="folders"',
          '    row-key="id"',
          '    lazy',
          '    :load="(row, node, resolve) => api.children(row.id).then(resolve)"',
          '    :tree-props="{ hasChildren: \'hasChildren\' }"',
          '  >',
          '    <el-table-column prop="name" label="Name" />',
          '  </el-table>',
          '</template>',
          '',
        ].join('\n'),
        'src/components/Flat.vue': [
          '<template>',
          '  <el-tree lazy :load="loadNode" />',
          '  <el-table :data="files">',
          '    <el-table-column prop="name" label="Name" />',
          '  </el-table>',
          '</template>',
          '',
        ].join('\n'),
      }),
    );
    const lazy = report.usages.find((u) => u.file === 'src/components/Lazy.vue');
    assert.equal(feature(lazy, 'lazy-tree').fit, 'maps');
    assert.match(
      feature(lazy, 'lazy-tree').argus,
      /dataSource\.hasChildren, dataSource\.getChildren/,
    );
    // A lazy tree isn't also mapped as a tree held in memory.
    assert.equal(feature(lazy, 'tree'), undefined);
    const flat = report.usages.find((u) => u.file === 'src/components/Flat.vue');
    assert.equal(feature(flat, 'lazy-tree'), undefined);
  });

  it('maps AG Grid server-side tree data and MUI X lazy tree data as lazy trees only', async () => {
    const ag = await scan(
      project('next-app-aggrid', {
        'app/files/files-grid.tsx': [
          "'use client';",
          "import { AgGridReact } from 'ag-grid-react';",
          'export function FilesGrid({ datasource }) {',
          '  return (',
          '    <AgGridReact',
          '      rowModelType="serverSide"',
          '      serverSideDatasource={datasource}',
          '      treeData',
          '      isServerSideGroup={(row) => row.group}',
          '      getServerSideGroupKey={(row) => row.id}',
          '    />',
          '  );',
          '}',
          '',
        ].join('\n'),
      }),
    );
    const files = ag.usages.find((u) => u.file === 'app/files/files-grid.tsx');
    assert.equal(feature(files, 'server-side-tree').fit, 'partial');
    assert.equal(feature(files, 'tree-data'), undefined);

    const mui = await scan(
      project('mui-datagrid-pro', {
        'src/Files.tsx': [
          "import { DataGridPro } from '@mui/x-data-grid-pro';",
          'const dataSource = {',
          '  getRows: (params) => fetchRows(params.groupKeys),',
          '  getGroupKey: (row) => row.name,',
          '  getChildrenCount: (row) => row.descendantCount,',
          '};',
          'export function Files() {',
          '  return <DataGridPro columns={[]} treeData dataSource={dataSource} />;',
          '}',
          '',
        ].join('\n'),
      }),
    );
    const tree = mui.usages.find((u) => u.file === 'src/Files.tsx');
    assert.equal(feature(tree, 'lazy-tree').fit, 'partial');
    assert.equal(feature(tree, 'tree-data'), undefined);
  });

  it('reads PrimeNG tree tables under every tag spelling, lazy ones too', async () => {
    const report = await scan(
      project('angular-material-primeng', {
        'src/app/files/files.component.html': [
          '<p-treetable [value]="files" [lazy]="true" (onNodeExpand)="load($event)">',
          '  <ng-template #body let-rowNode let-row="rowData"><tr><td>{{ row.name }}</td></tr></ng-template>',
          '</p-treetable>',
          '<p-tree-table [value]="folders"></p-tree-table>',
          '',
        ].join('\n'),
      }),
    );
    const files = report.usages.filter((u) => u.file === 'src/app/files/files.component.html');
    assert.deepEqual(
      files.map((u) => [u.line, feature(u, 'tree')?.fit, feature(u, 'lazy-tree')?.fit]),
      [
        // The lazy tree table is mapped as a lazy tree only.
        [1, undefined, 'maps'],
        [4, 'maps', undefined],
      ],
    );
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
    assert.equal(web.argus.packages['@argus-table/react'].version, '1.4.0');
    assert.deepEqual(web.argus.mismatched, ['argus-table@1.0.0', '@argus-table/react@1.4.0']);
    assert.deepEqual(web.argus.duplicates, ['1.0.0', '1.4.0']);
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
