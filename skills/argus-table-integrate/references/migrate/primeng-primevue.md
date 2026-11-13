# From PrimeNG and PrimeVue DataTable

Covers PrimeNG's `<p-table>` (Angular) and PrimeVue's `<DataTable>` with `<Column>` children (Vue), v3 to v20. Both have the same model: a `value` array, columns as template children, `paginator`, `lazy` loading, `selection`, frozen columns.

## Detect

PrimeNG: `<p-table [value]>`, `TableModule` from `primeng/table`, `pSortableColumn`, `<p-sortIcon>`, `pFrozenColumn`, `#header` / `#body` templates. PrimeVue: `<DataTable :value>` with `<Column field header>`, imported from `primevue/datatable` (or registered globally).

## Concepts

| Feature id      | PrimeNG / PrimeVue                                                                 | argus-table                                                                   | Fit     | Notes                                                                           |
| --------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `sort`          | `pSortableColumn` / `sortable` on `<Column>`, `sortField`, `sortOrder`             | `sortable: true`, `sorting`                                                   | maps    | `sortOrder: -1` → `desc: true`                                                  |
| `multi-sort`    | `sortMode="multiple"`, `multiSortMeta`                                             | `sorting` with several items, set by the app                                  | partial | A header click sorts by that column alone                                       |
| `paginator`     | `paginator`, `rows`, `rowsPerPageOptions`                                          | none: the table scrolls                                                       | gap     | [gaps.md](../gaps.md#pagination)                                                |
| `lazy`          | `lazy`, `(onLazyLoad)` / `@page` / `@sort`, `totalRecords`                         | `dataSource.getRows`, `total`                                                 | maps    | `first`/`rows` → `start`/`end - start`                                          |
| `selection`     | `selectionMode`, `[(selection)]` / `v-model:selection`, `dataKey`, checkbox column | `selectionMode`, `selectionCheckboxes`, two-way `selection` (ids), `getRowId` | maps    | Selection holds ids, not row objects                                            |
| `global-filter` | `globalFilterFields`, `filterGlobal()`                                             | `quickFilter` (searches every shown column)                                   | maps    |                                                                                 |
| `column-filter` | `<p-columnFilter>`, `filters` with `matchMode`                                     | `filter` kinds, `columnFilters`, header-menu                                  | maps    | `contains`/`equals`/`startsWith`/`lt`/`gt`… have equivalents                    |
| `filter-row`    | `filterDisplay="row"`                                                              | none                                                                          | gap     | [gaps.md](../gaps.md#filter-row)                                                |
| `frozen`        | `pFrozenColumn` / `frozen`, `alignFrozen="right"`                                  | `pin: 'start' / 'end'`                                                        | maps    |                                                                                 |
| `frozen-rows`   | `frozenValue`                                                                      | `pinnedRows.top`                                                              | maps    |                                                                                 |
| `resize`        | `resizableColumns`, `columnResizeMode`                                             | `resizable` (on by default)                                                   | maps    |                                                                                 |
| `reorder`       | `reorderableColumns`                                                               | `reorderable` (on by default), `columnOrder`                                  | maps    |                                                                                 |
| `virtual`       | `virtualScroll`, `virtualScrollerOptions`                                          | built in                                                                      | builtin |                                                                                 |
| `scroll-height` | `scrollable`, `scrollHeight="400px"`                                               | the table's height (`style="height: 400px"`)                                  | maps    | `scrollHeight="flex"` → fill a flex parent ([styling.md](../styling.md#height)) |
| `edit`          | `pEditableColumn`, `editMode="cell" / "row"`                                       | none                                                                          | gap     | [gaps.md](../gaps.md#editing)                                                   |
| `row-group`     | `rowGroupMode`, `groupRowsBy`                                                      | none                                                                          | gap     | [gaps.md](../gaps.md#row-grouping)                                              |
| `expansion`     | `expandedRowKeys`, `pRowToggler`, `#expandedrow`                                   | none                                                                          | gap     | [gaps.md](../gaps.md#master-detail)                                             |
| `col-group`     | `<p-columnGroup>` / `<ColumnGroup>` header rows                                    | `columnGroups`                                                                | maps    |                                                                                 |
| `export`        | `exportCSV()`                                                                      | `@argus-table/export`                                                         | maps    |                                                                                 |
| `state`         | `stateStorage`, `stateKey`                                                         | `getState()` / `setState()` with your storage                                 | maps    |                                                                                 |
| `tree`          | `<p-treeTable>` / `<TreeTable>`                                                    | none                                                                          | gap     | [gaps.md](../gaps.md#tree-data)                                                 |
| `row-click`     | `(onRowSelect)`, `@row-click`                                                      | `rowClick` / `@row-click`                                                     | maps    |                                                                                 |

## Columns

PrimeVue `<Column field="price" header="Price" sortable frozen />` and PrimeNG's header/body template pairs both become one `ColumnDef`:

| Prime                                                     | argus-table                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `field="price"`                                           | `id: 'price', accessor: 'price'`                                |
| `header="Price"`                                          | `header: 'Price'`                                               |
| `sortable` / `pSortableColumn="price"`                    | `sortable: true`                                                |
| `frozen` / `pFrozenColumn`                                | `pin: 'start'` (`alignFrozen="right"` → `'end'`)                |
| `style="width: 10rem"`, `headerStyle`                     | `width: 160`                                                    |
| `<template #body="{ data }">` (PrimeVue)                  | a `#cell-price="{ row }"` slot on `ArgusTable`                  |
| `<td>{{ product.price \| currency }}</td>` (PrimeNG body) | `cell: (p) => money.format(p.price)` or an `argusCell` template |
| `selectionMode="multiple"` column                         | delete it: `selectionCheckboxes`                                |
| `dataKey="id"`                                            | `getRowId: (row) => String(row.id)` on the table                |

## State and events

- Selection holds row objects in Prime; argus-table holds ids. Map with your rows when the app needs objects.
- `(onLazyLoad)="load($event)"` with `first`, `rows`, `sortField`, `sortOrder`, `filters` → `getRows({ start, end, sorting, filters })`; `totalRecords` → `total`.
- `(onSort)` → `(sortingChange)` / `@sorting-change`.

## Example

```vue
<!-- Before (PrimeVue) -->
<DataTable v-model:selection="selected" :value="products" dataKey="id" paginator :rows="20">
  <Column selectionMode="multiple" />
  <Column field="code" header="Code" sortable frozen />
  <Column field="price" header="Price" sortable>
    <template #body="{ data }">{{ money(data.price) }}</template>
  </Column>
</DataTable>

<!-- After -->
<ArgusTable
  v-model:selection="selectedIds"
  aria-label="Products"
  :columns="columns"
  :data="products"
  :get-row-id="getRowId"
  selection-mode="multi"
  selection-checkboxes
>
  <template #cell-price="{ row }">{{ money(row.price) }}</template>
</ArgusTable>
<!-- script: columns = [{ id: 'code', header: 'Code', accessor: 'code', sortable: true, pin: 'start' },
                        { id: 'price', header: 'Price', accessor: 'price', sortable: true, align: 'end' }] -->
```

## Gaps

Pagination, a filter row, editing, row grouping, row expansion, tree tables. See [gaps.md](../gaps.md).

## Remove

`TableModule` (PrimeNG) or the `DataTable` / `Column` / `ColumnGroup` imports and global registrations (PrimeVue). Keep `primeng` / `primevue` for the rest of the app. Remove `p-datatable` style overrides.

## Behaviour differences

- Sorting toggles asc → desc → none on header click; there's no `removableSort` setting.
- Selection is ids (`string[]`), not row objects.
- No paginator: one scrolling list.
- Theme: `bootstrap` or `default` look closest to Prime's Aura/Lara presets; map the preset's colours to tokens for a match.
