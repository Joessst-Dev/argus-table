# From Vuetify `v-data-table`

Covers Vuetify 3's `v-data-table`, `v-data-table-server` and `v-data-table-virtual`.

## Detect

`<v-data-table`, `<v-data-table-server`, `<v-data-table-virtual` (or `VDataTable…` components) with `:headers="[{ title, key }]"` and `:items`.

## Concepts

| Feature id   | Vuetify                                                              | argus-table                                                                  | Fit     | Notes                                                  |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| `headers`    | `:headers="[{ title, key, value, align, sortable, width }]"`         | `:columns`                                                                   | maps    | One `ColumnDef` per header                             |
| `server`     | `v-data-table-server`, `:items-length`, `@update:options`            | `:data-source` with `getRows`                                                | maps    | [server-data.md](../server-data.md)                    |
| `pagination` | `:items-per-page`, `v-model:page`, the footer                        | none: the table scrolls                                                      | gap     | [gaps.md](../gaps.md#pagination)                       |
| `select`     | `show-select`, `v-model` (selected), `item-value`, `select-strategy` | `selection-mode`, `selection-checkboxes`, `v-model:selection`, `:get-row-id` | maps    | `select-strategy="single"` → `selection-mode="single"` |
| `sort`       | `v-model:sort-by`, `must-sort`, `sortable` (default true)            | `sortable: true`, `v-model:sorting`                                          | maps    | `[{ key, order: 'desc' }]` → `[{ id, desc: true }]`    |
| `multi-sort` | `multi-sort`                                                         | `sorting` with several items, set by the app                                 | partial |                                                        |
| `search`     | `:search`                                                            | `:quick-filter`                                                              | maps    |                                                        |
| `fixed`      | `fixed: true` on a header, `fixed-header`                            | `pin: 'start'`; the header is always fixed                                   | maps    |                                                        |
| `slots`      | `#item.<key>="{ item, value }"`, `#header.<key>`                     | `#cell-<id>="{ row, value }"`, `#header-<id>`                                | maps    | `item` → `row`                                         |
| `expand`     | `show-expand`, `#expanded-row`                                       | none                                                                         | gap     | [gaps.md](../gaps.md#master-detail)                    |
| `group`      | `group-by`                                                           | none                                                                         | gap     | [gaps.md](../gaps.md#row-grouping)                     |
| `density`    | `density="compact" / "comfortable" / "default"`                      | `density="compact" / "spacious" / "comfortable"`                             | maps    | Vuetify's `default` → `comfortable`                    |
| `virtual`    | `v-data-table-virtual`                                               | built in                                                                     | builtin |                                                        |
| `row-click`  | `@click:row="(e, { item })"`                                         | `@row-click="(e) => e.detail.row"`                                           | maps    |                                                        |

## Columns

| Vuetify header                                     | `ColumnDef`                                         |
| -------------------------------------------------- | --------------------------------------------------- |
| `{ title: 'Name', key: 'name' }`                   | `{ id: 'name', header: 'Name', accessor: 'name' }`  |
| `value: 'address.city'` or `value: (item) => …`    | `accessor: 'address.city'` / `accessor: (row) => …` |
| `align: 'end'`                                     | `align: 'end'`                                      |
| `sortable: false` (default true)                   | `sortable: true` on the sortable ones               |
| `width: 120`, `minWidth`, `maxWidth`               | the same                                            |
| `fixed: true`                                      | `pin: 'start'`                                      |
| `key: 'data-table-select'` / `'data-table-expand'` | delete: `selection-checkboxes` / a gap              |
| `children: [...]`                                  | `columnGroups`                                      |

## State and events

- `v-model` (selected item values) → `v-model:selection` (string ids from `getRowId`).
- `@update:options="load"` with `{ page, itemsPerPage, sortBy }` → `getRows({ start, end, sorting, quickFilter })`; `items-length` → `total`; `:loading` goes away (rows load as skeletons).
- `:search` → `:quick-filter` (the server mode gets it in `getRows`).

## Example

```vue
<!-- Before -->
<v-data-table-server
  v-model="selected"
  :headers="headers"
  :items="items"
  :items-length="total"
  :items-per-page="25"
  item-value="id"
  show-select
  @update:options="load"
>
  <template #item.status="{ value }"><v-chip>{{ value }}</v-chip></template>
</v-data-table-server>

<!-- After -->
<ArgusTable
  v-model:selection="selected"
  aria-label="Users"
  :columns="columns"
  :data-source="usersSource"
  :get-row-id="getRowId"
  selection-mode="multi"
  selection-checkboxes
>
  <template #cell-status="{ value }"><v-chip>{{ value }}</v-chip></template>
</ArgusTable>
```

Vuetify components keep working inside cells: slots render with the app's context.

## Gaps

Pagination, expandable rows, grouping. See [gaps.md](../gaps.md).

## Remove

The `v-data-table*` usage; keep Vuetify for the rest of the app.

## Behaviour differences

- Columns sort only with `sortable: true` (Vuetify sorts every header by default).
- No footer with page controls: one scrolling list.
- Theme: `material` is closest to Vuetify's look; map the Vuetify theme's colours to tokens (or set `data-argus-theme` from Vuetify's dark mode).
