# From Element Plus `el-table`

Covers `<el-table>` with `<el-table-column>` children, and `<el-table-v2>` (Element Plus 2).

## Detect

`<el-table :data>` with `<el-table-column prop label>` children (or `ElTable` / `ElTableColumn`), often next to `<el-pagination>`. Check the row type and the data for a `children` array too: with `row-key`, Element Plus shows such rows as a tree with no other prop (`tree`).

## Concepts

| Feature id      | Element Plus                                                                                     | argus-table                                                                                 | Fit     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`       | `<el-table-column prop label width min-width>`                                                   | `ColumnDef` (`id`, `accessor`, `header`, `width`, `minWidth`)                               | maps    | Or `<ArgusColumn>` children                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `sortable`      | `sortable`, `default-sort`                                                                       | `sortable: true`, `v-model:sorting`                                                         | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `server-sort`   | `sortable="custom"`, `@sort-change`                                                              | `dataSource` (the server sorts), `sorting`                                                  | maps    | [server-data.md](../server-data.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `fixed`         | `fixed` / `fixed="right"`                                                                        | `pin: 'start' / 'end'`                                                                      | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `selection`     | `type="selection"` column, `@selection-change`                                                   | `selection-mode`, `selection-checkboxes`, `v-model:selection`                               | maps    | Selection holds ids, not row objects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `row-key`       | `row-key="id"`                                                                                   | `:get-row-id="(r) => String(r.id)"`                                                         | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `current-row`   | `highlight-current-row`, `@current-change`                                                       | `selection-mode="single"`                                                                   | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `index`         | `type="index"`                                                                                   | a column with `cell: (row, ctx) => ctx.index + 1`                                           | partial | The index follows the current sort                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `expand`        | `type="expand"`                                                                                  | `#detail`, `v-model:expanded`                                                               | partial | Panels from `rowDetail` (anything a cell can show, a nested table too), opened by a chevron column; `expanded` holds the open row ids, two-way (`argus-expanded-change`). As tall as their content up to `--argus-detail-max-height` (400px), then they scroll; no full-row detail renderer API, no expand-all. `type="expand"`'s slot → `#detail`, `expand-row-keys` → `expanded`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `filters`       | `:filters`, `:filter-method`                                                                     | `filter: 'set'`, `filterOptions`, `filterFn`                                                | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `summary`       | `show-summary`, `summary-method`                                                                 | `pinnedRows.bottom`                                                                         | partial | A totals row object                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `span`          | `span-method`                                                                                    | none                                                                                        | gap     | [gaps.md](../gaps.md#cell-spanning)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tree`          | `row-key` with `children` in rows (no prop needed), `tree-props`, `default-expand-all`, `indent` | `:get-sub-rows`, `:get-row-id`, `v-model:tree-expanded`                                     | maps    | Element Plus shows any row with a `children` array as a tree once `row-key` is set: `row-key="id"` → `:get-row-id="(r) => r.id"`, the `tree-props` `children` field (default `children`) → `:get-sub-rows="(r) => r.children"`. `default-expand-all` → `treeExpanded` with every parent's id; `expand-row-keys` of tree rows → `v-model:tree-expanded`; `@expand-change` → `@tree-expanded-change`. With a selection column, a row's checkbox checks its children unless `tree-props` has `checkStrictly: true`: by default (or with `false`) add `select-branches`; with `true`, leave it off. `indent` → the `--argus-tree-indent` token. (`default-expand-all` also opens `type="expand"` rows: check which one the table uses.) For a lazy tree (children loaded on expand), follow the `lazy-tree` row instead: `getSubRows` is ignored with a `dataSource`. For a lazy tree (children loaded on expand), follow the `lazy-tree` row instead: `getSubRows` is ignored with a `dataSource`. Since 1.4 |
| `lazy-tree`     | `lazy` + `:load`, `hasChildren`                                                                  | a `dataSource` with `hasChildren` and `getChildren`, `:get-row-id`, `v-model:tree-expanded` | maps    | `:load="(row, treeNode, resolve) => …"` → `getChildren: async ({ parent }) => ({ rows: await fetchChildren(parent) })`: return the rows instead of calling `resolve`. The rows' `hasChildren` field (the `tree-props` `hasChildren` name) → `hasChildren: (r) => r.hasChildren`. The top-level `:data` → the source's `getRows` (`{ rows: rows.slice(start, end), total: rows.length }` when the top level comes in one request). `row-key` → `:get-row-id`. Sorting and filtering then go to `getRows` and `getChildren`, as with any `dataSource`; the table keeps loaded children until they change. See [Lazy trees](#lazy-trees) and [server-data.md](../server-data.md#children-loaded-on-expand). Since 1.4                                                                                                                                                                                                                                                                                        |
| `height`        | `height`, `max-height`                                                                           | the table's height                                                                          | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `stripe-border` | `stripe`, `border`                                                                               | the theme (`bootstrap` is striped and bordered)                                             | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `slots`         | `<template #default="scope">` in a column                                                        | `#cell-<id>="{ row }"`                                                                      | maps    | `scope.row` → `row`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pagination`    | `<el-pagination>`                                                                                | none: the table scrolls                                                                     | gap     | [gaps.md](../gaps.md#pagination)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `row-click`     | `@row-click="(row) => …"`                                                                        | `@row-click="(e) => e.detail.row"`                                                          | maps    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Columns

```vue
<!-- Before -->
<el-table-column prop="customer" label="Customer" sortable min-width="200" />
<el-table-column prop="total" label="Total" align="right" fixed="right">
  <template #default="scope">{{ money(scope.row.total) }}</template>
</el-table-column>
```

```ts
// After (script setup)
const columns: ColumnDef<Order>[] = [
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    sortable: true,
    minWidth: 200,
    width: { flex: 1 },
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    align: 'end',
    pin: 'end',
    cell: (o) => money(o.total),
  },
];
```

Element Plus components (`el-tag`, `el-button`) keep working in `#cell-<id>` slots.

## State and events

- `@selection-change="(rows) => …"` → `v-model:selection` (ids); map ids to rows when needed.
- `@sort-change="({ prop, order })"` → `v-model:sorting` (`[{ id: prop, desc: order === 'descending' }]`).
- `<el-pagination>` with `current-page` / `page-size` and a fetch → a `dataSource` ([server-data.md](../server-data.md)).

## Example

```vue
<ArgusTable
  v-model:selection="selected"
  aria-label="Orders"
  style="height: 500px"
  :columns="columns"
  :data="orders"
  :get-row-id="getRowId"
  selection-mode="multi"
  selection-checkboxes
  @row-click="(e) => open(e.detail.row)"
>
  <template #cell-status="{ row }"><el-tag>{{ row.status }}</el-tag></template>
</ArgusTable>
```

### Lazy trees

`<el-table :data="folders" row-key="id" lazy :load="load">`, with `load(row, treeNode, resolve)` calling `resolve(children)`, becomes a `dataSource`. The table no longer sorts these rows: `getRows` and `getChildren` sort them by `sorting` (or pass it to the API, if it sorts). With `filter` on columns or a `quickFilter`, apply `filters` and `quickFilter` there too.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { ArgusTable, type ColumnDef, type DataSource, type SortState } from '@argus-table/vue';
import { api, type Folder } from './api';

const columns: ColumnDef<Folder>[] = [
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'size', header: 'Size', accessor: 'size', sortable: true, align: 'end' },
];

const compare: Record<string, ((a: Folder, b: Folder) => number) | undefined> = {
  name: (a, b) => a.name.localeCompare(b.name),
  size: (a, b) => a.size - b.size,
};
function sorted(rows: readonly Folder[], sorting: SortState): readonly Folder[] {
  const by = sorting[0];
  const fn = by && compare[by.id];
  if (!by || !fn) return rows;
  return [...rows].sort((a, b) => (by.desc ? fn(b, a) : fn(a, b)));
}

// The top level comes in one request: fetch it once, and slice a page from it.
let topLevel: Promise<Folder[]> | undefined;
const folders: DataSource<Folder> = {
  pageSize: 500,
  async getRows({ start, end, sorting }) {
    topLevel ??= api.topLevel();
    const rows = sorted(await topLevel, sorting);
    return { rows: rows.slice(start, end), total: rows.length };
  },
  hasChildren: (folder) => folder.hasChildren,
  async getChildren({ parent, sorting, signal }) {
    return { rows: sorted(await api.children(parent.id, { signal }), sorting) };
  },
};
const rowId = (folder: Folder) => folder.id;
const open = ref<readonly string[]>([]);
</script>

<template>
  <ArgusTable
    v-model:tree-expanded="open"
    aria-label="Folders"
    style="height: 500px"
    :columns="columns"
    :data-source="folders"
    :get-row-id="rowId"
  />
</template>
```

Keep `folders` and `rowId` in `<script setup>` (or a module): a new `dataSource` or `getRowId` reloads the rows and drops the loaded children. To fetch the top level again, clear `topLevel` before calling the table's `refresh()`.

## Gaps

Pagination, span methods. See [gaps.md](../gaps.md).

## Remove

The `el-table` / `el-table-column` / `el-pagination` usage. Keep `element-plus` for the rest of the app.

## Behaviour differences

- Selection is ids, not row objects.
- One scrolling list instead of pages; the header stays in place.
- Theme: `bootstrap` (striped, bordered) or `default`; map Element Plus's `--el-color-primary` to `--argus-focus-ring` and the selection colour.
