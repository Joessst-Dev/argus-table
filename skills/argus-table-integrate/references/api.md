# argus-table API

The public API of `argus-table` 1.1 and its wrappers, for writing code. Types come from `argus-table` or the wrapper you use (they re-export every type). Full docs: the package READMEs and https://joessst-dev.github.io/argus-table/.

## Properties

"Two-way" properties are controllable: uncontrolled until the app sets them; once set, user actions only fire `argus-<property>-change` with the proposed value, and nothing changes until the app sets it. Setting `undefined` hands the state back to the table.

| Property              | Attribute              | Type                                       | Default         | Notes                                                                                             |
| --------------------- | ---------------------- | ------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------- |
| `columns`             |                        | `ColumnDef<T>[]`                           | `[]`            | Wins over `<argus-column>` children when not empty                                                |
| `columnGroups`        |                        | `ColumnGroup[]`                            | `[]`            | Header groups over the flat `columns`                                                             |
| `data`                |                        | `T[]`                                      | `[]`            | Replace the array to change rows; changes inside it aren't seen (`refresh()` after mutating)      |
| `dataSource`          |                        | `DataSource<T>`                            |                 | Rows loaded page by page; wins over `data` while set. [server-data.md](server-data.md)            |
| `pinnedRows`          |                        | `{ top?: T[]; bottom?: T[] }`              |                 | Separate rows kept at the top or bottom: totals, summaries. Not sorted, filtered or selectable    |
| `getRowId`            |                        | `(row: T, index: number) => string`        | the index       | Needed for selection and `dataSource`; must return a string                                       |
| `rowHeight`           | `row-height`           | `number \| 'auto'`                         | from `density`  | `'auto'`: rows fit their content (with `wrap` columns)                                            |
| `density`             | `density`              | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | Row height and padding from the theme                                                             |
| `overscan`            | `overscan`             | `number`                                   | `6`             | Rows rendered beyond the view on each side                                                        |
| `virtualizeColumns`   | `virtualize-columns`   | `boolean`                                  | `false`         | Renders only the columns in view; for very wide tables (50+ columns)                              |
| `sorting`             |                        | `SortState` (`{ id, desc }[]`)             | uncontrolled    | Two-way. A header click sorts by that column alone; several items sort by several columns         |
| `columnSizing`        |                        | `Record<id, px>`                           | uncontrolled    | Two-way                                                                                           |
| `columnOrder`         |                        | `string[]` (column ids)                    | uncontrolled    | Two-way. Users reorder by dragging headers or Alt+Shift+Arrow                                     |
| `columnPinning`       |                        | `Record<id, 'start' \| 'end' \| false>`    | uncontrolled    | Two-way; overrides `ColumnDef.pin`                                                                |
| `columnVisibility`    |                        | `Record<id, boolean>`                      | uncontrolled    | Two-way; overrides `ColumnDef.hidden` (`false` hides)                                             |
| `columnFilters`       |                        | `Record<id, ColumnFilter>`                 | uncontrolled    | Two-way. Users set filters through `@argus-table/header-menu`                                     |
| `quickFilter`         | `quick-filter`         | `string`                                   | `''`            | Rows where every word appears in some shown column. Not two-way: bind it to your own search input |
| `selectionMode`       | `selection-mode`       | `'none' \| 'single' \| 'multi'`            | `'none'`        | Click selects; Ctrl/Cmd+click toggles; Shift+click selects a range; Space and Ctrl/Cmd+A          |
| `selectionCheckboxes` | `selection-checkboxes` | `boolean`                                  | `false`         | A checkbox column (and select-all in `multi`)                                                     |
| `selection`           |                        | `string[]` (row ids)                       | uncontrolled    | Two-way. Ids are never dropped by the table                                                       |
| `plugins`             |                        | `ArgusPlugin<T>[]`                         | `[]`            | Add-ons: `[tableExport(), formulas(), headerMenu()]`, in that order. Keep the array stable        |
| `labels`              |                        | `Partial<TableLabels>`                     | English         | Built-in text (Retry, Select row, announcements). Since 1.1                                       |

## Events

All bubble and are composed `CustomEvent`s. The wrappers' names: React `on<Name>` props, Vue `@<name>` (and `update:<property>` for two-way state), Angular `(<name>)` outputs (state outputs emit the value).

| Event                            | React                      | Vue                        | Angular                  | `detail`                                                               |
| -------------------------------- | -------------------------- | -------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `argus-sorting-change`           | `onSortingChange`          | `sorting-change`           | `sortingChange`          | `{ sorting }`                                                          |
| `argus-column-sizing-change`     | `onColumnSizingChange`     | `column-sizing-change`     | `columnSizingChange`     | `{ columnSizing, columnId, width }`: every frame of a drag             |
| `argus-column-resize-end`        | `onColumnResizeEnd`        | `column-resize-end`        | `columnResizeEnd`        | `{ columnSizing, columnIds }`: once a resize is done; save widths here |
| `argus-column-order-change`      | `onColumnOrderChange`      | `column-order-change`      | `columnOrderChange`      | `{ columnOrder, columnId, groupId? }`                                  |
| `argus-column-pinning-change`    | `onColumnPinningChange`    | `column-pinning-change`    | `columnPinningChange`    | `{ columnPinning, columnId, pin }`                                     |
| `argus-column-visibility-change` | `onColumnVisibilityChange` | `column-visibility-change` | `columnVisibilityChange` | `{ columnVisibility, columnId, visible }`                              |
| `argus-column-filters-change`    | `onColumnFiltersChange`    | `column-filters-change`    | `columnFiltersChange`    | `{ columnFilters, columnId, columnFilter }`                            |
| `argus-selection-change`         | `onSelectionChange`        | `selection-change`         | `selectionChange`        | `{ selection }`                                                        |
| `argus-cell-click`               | `onCellClick`              | `cell-click`               | `cellClick`              | `{ row, rowId, index, columnId, value, pinned? }`; also Enter          |
| `argus-row-click`                | `onRowClick`               | `row-click`                | `rowClick`               | `{ row, rowId, index, pinned? }`; also Enter                           |
| `argus-range-change`             | `onRangeChange`            | `range-change`             | `rangeChange`            | `{ first, last }`: the rows in view, inclusive                         |
| `argus-load-error`               | `onLoadError`              | `load-error`               | `loadError`              | `{ error, start, end }`: a `dataSource` page failed                    |

`formulas()` adds `argus-formula-column-add`, `-change` and `-remove` (`onFormulaColumnAdd`, `@formula-column-add`, `(formulaColumnAdd)`), see [addons.md](addons.md).

## Methods

Call them on the element: a React `ref`, Vue `ref` (the component exposes them), Angular `@ViewChild(ArgusTableComponent)` (the component has them), or the element itself.

| Method                           | Returns            | What it does                                                                                               |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `refresh()`                      | `Promise<void>`    | Reloads a `dataSource`'s pages (keeping the scroll position), or re-reads `data` changed in place          |
| `autosizeColumns(ids?)`          | `Promise<void>`    | Fits columns to their content, like a double-click on a resize handle                                      |
| `scrollToRow(target, { align })` | `Promise<boolean>` | `target`: an index in the current order, or `{ id }`. `align`: `'start'`, `'center'`, `'end'`, `'nearest'` |
| `scrollToColumn(id, { align })`  | `Promise<boolean>` | Scrolls a column into view (since 1.1)                                                                     |
| `getState()`                     | `TableState`       | Sorting, sizing, order, pinning, visibility, filters, selection, quick filter, scroll: save it as JSON     |
| `setState(state)`                | `Promise<void>`    | Restores a saved state (fires no events; leaves controlled properties alone)                               |

## ColumnDef

`ColumnDef<T>` (React: `ReactColumnDef<T>` when cells return JSX; Vue: `VueColumnDef<T>` for VNodes; Angular: `ColumnDef<T>`, templates through `argusCell`).

| Field           | Type                                           | Default         | Notes                                                                            |
| --------------- | ---------------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `id`            | `string`                                       | required        | Unique and stable: state, events and saved layouts use it                        |
| `header`        | content, or `() => content`                    | empty           | Text, a node, a template; JSX/VNodes in the wrappers. Always give one            |
| `accessor`      | `'path.to.value'` or `(row, index) => unknown` | none            | What the column sorts, filters and exports. Without it, the value is `undefined` |
| `cell`          | `(row, ctx) => content`                        | the value       | `ctx`: `{ row, rowId, index, columnId, value, pinned? }`                         |
| `formula`       | `string`                                       |                 | Only with `formulas()`                                                           |
| `width`         | `number \| 'auto' \| { flex: number }`         | `150`           | px; `'auto'` fits content once; `{ flex }` shares the free space                 |
| `minWidth`      | `number`                                       | `40`            |                                                                                  |
| `maxWidth`      | `number`                                       | none            |                                                                                  |
| `pin`           | `'start' \| 'end'`                             | none            | Logical sides: start is left in LTR                                              |
| `hidden`        | `boolean`                                      | `false`         | Not shown, still sorts and exports with `hiddenColumns`                          |
| `sortable`      | `boolean`                                      | `false`         | Opt-in                                                                           |
| `resizable`     | `boolean`                                      | `true`          |                                                                                  |
| `reorderable`   | `boolean`                                      | `true`          | Drag the header to move the column                                               |
| `pinnable`      | `boolean`                                      | `true`          | Whether the column menu offers pinning                                           |
| `hideable`      | `boolean`                                      | `true`          | Whether the column menu offers hiding                                            |
| `filter`        | `'text' \| 'number' \| 'date' \| 'set'`        | none            | The filter users can set from the column menu                                    |
| `filterFn`      | `(value, filter, row) => boolean`              | built in        | Replaces the built-in test                                                       |
| `filterOptions` | `FilterValue[]`                                | distinct values | The values a `'set'` filter offers; required with a `dataSource`                 |
| `align`         | `'start' \| 'center' \| 'end'`                 | `'start'`       | Numbers: `'end'`                                                                 |
| `wrap`          | `boolean`                                      | `false`         | Wraps text; rows grow only with `rowHeight: 'auto'`                              |

## ColumnGroup

`columnGroups: ColumnGroup[]` puts header rows over the flat columns.

| Field         | Type                        | Notes                                                      |
| ------------- | --------------------------- | ---------------------------------------------------------- |
| `id`          | `string`                    |                                                            |
| `header`      | content, or `() => content` | The id when missing                                        |
| `reorderable` | `boolean`                   | Lets the group move as a whole (its columns must allow it) |
| `columns`     | `(string \| ColumnGroup)[]` | Column ids, or nested groups                               |

## DataSource

```ts
const dataSource: DataSource<Order> = {
  pageSize: 100,
  async getRows({ start, end, sorting, filters, quickFilter, signal }) {
    const res = await fetch(`/api/orders?offset=${start}&limit=${end - start}`, { signal });
    const body = await res.json();
    return { rows: body.items, total: body.total };
  },
};
```

`end` is exclusive. `total` is optional: without it, the table grows as pages arrive, and a page shorter than asked for ends the rows. Rejecting shows a Retry button and fires `argus-load-error`. Details: [server-data.md](server-data.md).

## Filters

`ColumnFilter` is one of:

- `{ kind: 'text', op: 'contains' | 'equals' | 'startsWith' | 'empty' | 'notEmpty', value? }`
- `{ kind: 'number', op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'between' | 'empty' | 'notEmpty', value?, to? }`
- `{ kind: 'date', op: …same…, value?: 'YYYY-MM-DD', to? }`
- `{ kind: 'set', values: FilterValue[] }`

`FilterValue` is `string | number | boolean | null`.

## `<argus-column>` children

Columns can be markup instead of `columns` (React `<ArgusColumn>`, Vue `<ArgusColumn>`, Angular `<argus-column>`): attributes `column-id`, `header`, `accessor` (a path), `formula`, `width` (`90`, `auto`, `2fr`), `min-width`, `max-width`, `pin`, `pinnable`, `hideable`, `align`, `wrap`, `sortable`, `resizable`, `reorderable`, `filter`, `hidden`; `cell`, `filterFn` and `filterOptions` as properties; a `<template>` child as static cell content. `<argus-column-group group-id header>` groups them.

## Slots, parts and tokens

- Slot `empty`: what shows when there are no rows.
- Parts (`argus-table::part(row-selected)`): `table`, `header`, `header-cell`, `header-cell-sorted`, `row`, `row-odd`, `row-even`, `row-selected`, `cell`, `cell-pinned`, `skeleton`, … (see the element's README).
- Tokens: `--argus-bg`, `--argus-fg`, `--argus-font`, `--argus-header-bg`, `--argus-border-color`, `--argus-row-height`, `--argus-cell-padding-inline`, `--argus-row-hover-bg`, `--argus-row-selected-bg`, `--argus-focus-ring`, … Set them on `argus-table` after the theme.
