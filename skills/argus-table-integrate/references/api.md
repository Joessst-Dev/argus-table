# argus-table API

The public API of `argus-table` 1.2 and its wrappers, for writing code. Types come from `argus-table` or the wrapper you use (they re-export every type). Full docs: the package READMEs and https://joessst-dev.github.io/argus-table/.

## Properties

"Two-way" properties are controllable: uncontrolled until the app sets them; once set, user actions only fire `argus-<property>-change` with the proposed value, and nothing changes until the app sets it. Setting `undefined` hands the state back to the table.

| Property              | Attribute              | Type                                         | Default         | Notes                                                                                                           |
| --------------------- | ---------------------- | -------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| `columns`             |                        | `ColumnDef<T>[]`                             | `[]`            | Wins over `<argus-column>` children when not empty                                                              |
| `columnGroups`        |                        | `ColumnGroup[]`                              | `[]`            | Header groups over the flat `columns`                                                                           |
| `data`                |                        | `T[]`                                        | `[]`            | Replace the array to change rows; changes inside it aren't seen (`refresh()` after mutating)                    |
| `dataSource`          |                        | `DataSource<T>`                              |                 | Rows loaded page by page; wins over `data` while set. [server-data.md](server-data.md)                          |
| `pinnedRows`          |                        | `{ top?: T[]; bottom?: T[] }`                |                 | Separate rows kept at the top or bottom: totals, summaries. Not sorted, filtered or selectable                  |
| `getRowId`            |                        | `(row: T, index: number) => string`          | the index       | Needed for selection and `dataSource`; must return a string                                                     |
| `getSubRows`          |                        | `(row: T) => T[] \| undefined`               | none            | Nested tree data: a row's children; `data` holds the top-level rows. See [Tree rows](#tree-rows). Since 1.4     |
| `getParentId`         |                        | `(row: T) => string \| null \| undefined`    | none            | Flat tree data: a row's parent id (a `getRowId` id), `null` at the top level; `data` holds every row. Since 1.4 |
| `rowHeight`           | `row-height`           | `number \| 'auto'`                           | from `density`  | `'auto'`: rows fit their content (with `wrap` columns)                                                          |
| `density`             | `density`              | `'compact' \| 'comfortable' \| 'spacious'`   | `'comfortable'` | Row height and padding from the theme                                                                           |
| `overscan`            | `overscan`             | `number`                                     | `6`             | Rows rendered beyond the view on each side                                                                      |
| `virtualizeColumns`   | `virtualize-columns`   | `boolean`                                    | `false`         | Renders only the columns in view; for very wide tables (50+ columns)                                            |
| `stretchColumns`      | `stretch-columns`      | `boolean`                                    | `false`         | Columns fill the table's width; a resized column keeps its width; state keeps own widths. Since 1.4             |
| `sorting`             |                        | `SortState` (`{ id, desc }[]`)               | uncontrolled    | Two-way. A header click sorts by that column alone; several items sort by several columns                       |
| `columnSizing`        |                        | `Record<id, px>`                             | uncontrolled    | Two-way                                                                                                         |
| `columnOrder`         |                        | `string[]` (column ids)                      | uncontrolled    | Two-way. Users reorder by dragging headers or Alt+Shift+Arrow                                                   |
| `columnPinning`       |                        | `Record<id, 'start' \| 'end' \| false>`      | uncontrolled    | Two-way; overrides `ColumnDef.pin`                                                                              |
| `columnVisibility`    |                        | `Record<id, boolean>`                        | uncontrolled    | Two-way; overrides `ColumnDef.hidden` (`false` hides)                                                           |
| `columnFilters`       |                        | `Record<id, ColumnFilter>`                   | uncontrolled    | Two-way. Users set filters through `@argus-table/header-menu`                                                   |
| `quickFilter`         | `quick-filter`         | `string`                                     | `''`            | Rows where every word appears in some shown column. Not two-way: bind it to your own search input               |
| `selectionMode`       | `selection-mode`       | `'none' \| 'single' \| 'multi'`              | `'none'`        | Click selects; Ctrl/Cmd+click toggles; Shift+click selects a range; Space and Ctrl/Cmd+A                        |
| `selectionCheckboxes` | `selection-checkboxes` | `boolean`                                    | `false`         | A checkbox column (and select-all in `multi`)                                                                   |
| `selection`           |                        | `string[]` (row ids)                         | uncontrolled    | Two-way. Ids are never dropped by the table                                                                     |
| `selectBranches`      | `select-branches`      | `boolean`                                    | `false`         | With a tree, in `multi` mode: a row's checkbox selects its whole branch. Since 1.4                              |
| `rowDetail`           |                        | `({ row, rowId, index, depth? }) => content` | none            | A detail panel under a row, opened by a chevron column. Interactive content works                               |
| `rowExpandable`       |                        | `(row: T) => boolean`                        | every row       | Which rows get a chevron (`rowDetail`)                                                                          |
| `expanded`            |                        | `string[]` (row ids)                         | uncontrolled    | Two-way: the rows whose panel is open. Several at once                                                          |
| `treeExpanded`        |                        | `string[]` (row ids)                         | uncontrolled    | Two-way: the expanded rows of a tree. Since 1.4                                                                 |
| `plugins`             |                        | `ArgusPlugin<T>[]`                           | `[]`            | Add-ons: `[formulas(), headerMenu(), tableExport()]`, `formulas()` before `headerMenu()`. Keep the array stable |
| `labels`              |                        | `Partial<TableLabels>`                       | English         | Built-in text (Retry, Select row, announcements). Since 1.1                                                     |

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
| `argus-expanded-change`          | `onExpandedChange`         | `expanded-change`          | `expandedChange`         | `{ expanded, rowId, open }`                                            |
| `argus-tree-expanded-change`     | `onTreeExpandedChange`     | `tree-expanded-change`     | `treeExpandedChange`     | `{ treeExpanded, rowId, open }`                                        |
| `argus-cell-click`               | `onCellClick`              | `cell-click`               | `cellClick`              | `{ row, rowId, index, columnId, value, pinned?, depth? }`; also Enter  |
| `argus-row-click`                | `onRowClick`               | `row-click`                | `rowClick`               | `{ row, rowId, index, pinned?, depth? }`; also Enter                   |
| `argus-range-change`             | `onRangeChange`            | `range-change`             | `rangeChange`            | `{ first, last }`: the rows in view, inclusive                         |
| `argus-load-error`               | `onLoadError`              | `load-error`               | `loadError`              | `{ error, start, end }`: a `dataSource` page failed                    |

`formulas()` adds `argus-formula-column-add`, `-change` and `-remove` (`onFormulaColumnAdd`, `@formula-column-add`, `(formulaColumnAdd)`), see [addons.md](addons.md). `cellEditing()` (`@argus-table/editing`) adds `argus-cell-edit` (`onCellEdit`, `@cell-edit`, `(cellEdit)`).

## Methods

Call them on the element: a React `ref`, Vue `ref` (the component exposes them), Angular `@ViewChild(ArgusTableComponent)` (the component has them), or the element itself.

| Method                           | Returns            | What it does                                                                                                          |
| -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `refresh()`                      | `Promise<void>`    | Reloads a `dataSource`'s pages (keeping the scroll position), or re-reads `data` changed in place                     |
| `autosizeColumns(ids?)`          | `Promise<void>`    | Fits columns to their content, like a double-click on a resize handle                                                 |
| `scrollToRow(target, { align })` | `Promise<boolean>` | `target`: an index in the current order, or `{ id }`. `align`: `'start'`, `'center'`, `'end'`, `'nearest'`            |
| `scrollToColumn(id, { align })`  | `Promise<boolean>` | Scrolls a column into view (since 1.1)                                                                                |
| `getState()`                     | `TableState`       | Sorting, sizing, order, pinning, visibility, filters, selection, expanded rows, quick filter, scroll: save it as JSON |
| `setState(state)`                | `Promise<void>`    | Restores a saved state (fires no events; leaves controlled properties alone)                                          |

## ColumnDef

`ColumnDef<T>` (React: `ReactColumnDef<T>` when cells return JSX; Vue: `VueColumnDef<T>` for VNodes; Angular: `ColumnDef<T>`, templates through `argusCell`).

| Field           | Type                                           | Default         | Notes                                                                            |
| --------------- | ---------------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `id`            | `string`                                       | required        | Unique and stable: state, events and saved layouts use it                        |
| `header`        | content, or `(context) => content`             | empty           | Text, a node, a template; JSX/VNodes in the wrappers. Always give one            |
| `accessor`      | `'path.to.value'` or `(row, index) => unknown` | none            | What the column sorts, filters and exports. Without it, the value is `undefined` |
| `cell`          | `(row, ctx) => content`                        | the value       | `ctx`: `{ row, rowId, index, columnId, value, pinned?, depth? }`                 |
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
| `meta`          | `ColumnMeta` (an object)                       | none            | Plugins' and the app's own fields, such as `meta.export`. Since 1.2              |

A `header` function gets `{ columnId, text }` (a group's: `{ groupId, text }`). With `text: true` it returns the name as plain text: the column menu, exports and the table's announcements use it, where a JSX or template header would otherwise be named by its id. Since 1.2:

```tsx
header: ({ text }) => (text ? 'Total' : <b>Total</b>);
```

## ColumnGroup

`columnGroups: ColumnGroup[]` puts header rows over the flat columns.

| Field         | Type                               | Notes                                                      |
| ------------- | ---------------------------------- | ---------------------------------------------------------- |
| `id`          | `string`                           |                                                            |
| `header`      | content, or `(context) => content` | The id when missing                                        |
| `reorderable` | `boolean`                          | Lets the group move as a whole (its columns must allow it) |
| `columns`     | `(string \| ColumnGroup)[]`        | Column ids, or nested groups                               |

## Tree rows

Since 1.4. Rows with child rows, held in memory: nested (`getSubRows`) or flat (`getParentId`).

```ts
table.getRowId = (row) => row.id;
table.getSubRows = (row) => row.children; // nested data, or for flat data:
// table.getParentId = (row) => row.parentId; // null or undefined at the top level
table.treeExpanded = ['a', 'a/2']; // optional; two-way, like expanded
```

- The first shown data column holds the indent (`--argus-tree-indent` per level) and, on rows with children, the toggle (part `tree-toggle`, labels `expandTreeRow` / `collapseTreeRow`). Right expands a row, Left collapses it or moves to its parent. The host's role is `treegrid`.
- Children sort among their siblings. A filter keeps the matching rows with their ancestors, shown expanded while it's on (their toggles disabled, part `tree-toggle-disabled`), without changing `treeExpanded`.
- Default ids: the index in `data` at the top level, the parent's id, a dot and the index among siblings below (`'3.0'`, `'3.0.2'`). With flat data, give `getRowId`: `getParentId` returns those ids.
- `cell` contexts, `argus-cell-click`, `argus-row-click`, `argus-cell-edit` and `rowDetail` get `depth` (`0` at the top level), only when the rows form a tree. Indexes in events and `scrollToRow()` count the rows shown; `scrollToRow({ id })` resolves `false` for a row under a collapsed one.
- `selectBranches` (in `multi` mode): a row's checkbox selects its branch (the rows the filters keep), and a parent's id is in `selection` only while its whole branch is, rows a filter hides included: under a filter, ticking a parent selects its shown rows and leaves its id out until the hidden ones are selected too.
- Not with a `dataSource` yet (ignored, with a console warning): [gaps.md](gaps.md#lazy-trees).
- Plugins read `host.rowDepth(index, section?)`, and `host.sourceRow(index)` for an index `host.filteredIndexes()` returns (nested children's are `data.length` and up).
- Editing nested children: `applyEdit`'s fourth argument, [addons.md](addons.md#cell-editing-argus-tableediting).

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

Columns can be markup instead of `columns` (React `<ArgusColumn>`, Vue `<ArgusColumn>`, Angular `<argus-column>`): attributes `column-id`, `header`, `accessor` (a path), `formula`, `width` (`90`, `auto`, `2fr`), `min-width`, `max-width`, `pin`, `pinnable`, `hideable`, `align`, `wrap`, `sortable`, `resizable`, `reorderable`, `filter`, `hidden`; `cell`, `filterFn`, `filterOptions` and `meta` as properties; a `<template>` child as static cell content. `<argus-column-group group-id header>` groups them.

## Slots, parts and tokens

- Slot `empty`: what shows when there are no rows.
- Parts (`argus-table::part(row-selected)`): `table`, `header`, `header-cell`, `header-cell-sorted`, `row`, `row-odd`, `row-even`, `row-selected`, `cell`, `cell-pinned`, `skeleton`, `tree-toggle`, … (see the element's README).
- Tokens: `--argus-bg`, `--argus-fg`, `--argus-font`, `--argus-header-bg`, `--argus-border-color`, `--argus-row-height`, `--argus-cell-padding-inline`, `--argus-row-hover-bg`, `--argus-row-selected-bg`, `--argus-focus-ring`, `--argus-tree-indent`, … Set them on `argus-table` after the theme.
