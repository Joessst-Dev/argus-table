# From Element Plus `el-table`

Covers `<el-table>` with `<el-table-column>` children, and `<el-table-v2>` (Element Plus 2).

## Detect

`<el-table :data>` with `<el-table-column prop label>` children (or `ElTable` / `ElTableColumn`), often next to `<el-pagination>`.

## Concepts

| Feature id      | Element Plus                                   | argus-table                                                   | Fit     | Notes                                |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------- | ------- | ------------------------------------ |
| `columns`       | `<el-table-column prop label width min-width>` | `ColumnDef` (`id`, `accessor`, `header`, `width`, `minWidth`) | maps    | Or `<ArgusColumn>` children          |
| `sortable`      | `sortable`, `default-sort`                     | `sortable: true`, `v-model:sorting`                           | maps    |                                      |
| `server-sort`   | `sortable="custom"`, `@sort-change`            | `dataSource` (the server sorts), `sorting`                    | maps    | [server-data.md](../server-data.md)  |
| `fixed`         | `fixed` / `fixed="right"`                      | `pin: 'start' / 'end'`                                        | maps    |                                      |
| `selection`     | `type="selection"` column, `@selection-change` | `selection-mode`, `selection-checkboxes`, `v-model:selection` | maps    | Selection holds ids, not row objects |
| `row-key`       | `row-key="id"`                                 | `:get-row-id="(r) => String(r.id)"`                           | maps    |                                      |
| `current-row`   | `highlight-current-row`, `@current-change`     | `selection-mode="single"`                                     | maps    |                                      |
| `index`         | `type="index"`                                 | a column with `cell: (row, ctx) => ctx.index + 1`             | partial | The index follows the current sort   |
| `expand`        | `type="expand"`                                | none                                                          | gap     | [gaps.md](../gaps.md#master-detail)  |
| `filters`       | `:filters`, `:filter-method`                   | `filter: 'set'`, `filterOptions`, `filterFn`                  | maps    |                                      |
| `summary`       | `show-summary`, `summary-method`               | `pinnedRows.bottom`                                           | partial | A totals row object                  |
| `span`          | `span-method`                                  | none                                                          | gap     | [gaps.md](../gaps.md#cell-spanning)  |
| `tree`          | `tree-props`, `lazy` + `:load`                 | none                                                          | gap     | [gaps.md](../gaps.md#tree-data)      |
| `height`        | `height`, `max-height`                         | the table's height                                            | maps    |                                      |
| `stripe-border` | `stripe`, `border`                             | the theme (`bootstrap` is striped and bordered)               | maps    |                                      |
| `slots`         | `<template #default="scope">` in a column      | `#cell-<id>="{ row }"`                                        | maps    | `scope.row` → `row`                  |
| `pagination`    | `<el-pagination>`                              | none: the table scrolls                                       | gap     | [gaps.md](../gaps.md#pagination)     |
| `row-click`     | `@row-click="(row) => …"`                      | `@row-click="(e) => e.detail.row"`                            | maps    |                                      |

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

## Gaps

Pagination, expand rows, span methods, tree tables. See [gaps.md](../gaps.md).

## Remove

The `el-table` / `el-table-column` / `el-pagination` usage. Keep `element-plus` for the rest of the app.

## Behaviour differences

- Selection is ids, not row objects.
- One scrolling list instead of pages; the header stays in place.
- Theme: `bootstrap` (striped, bordered) or `default`; map Element Plus's `--el-color-primary` to `--argus-focus-ring` and the selection colour.
