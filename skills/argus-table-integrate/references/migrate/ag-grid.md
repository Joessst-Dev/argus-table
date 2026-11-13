# From AG Grid

Covers `ag-grid-community` and `ag-grid-enterprise` (v31 to v34) with `ag-grid-react`, `ag-grid-vue3` or `ag-grid-angular`, and `createGrid()`. Enterprise features (row grouping, pivoting, server-side row model, master/detail, range selection, side bar, Excel export) mostly have no equivalent: check the gaps first.

## Detect

`<AgGridReact`, `<ag-grid-vue>`, `<ag-grid-angular>`, `createGrid(`; `columnDefs: ColDef[]` with `field` and `headerName`; `ModuleRegistry.registerModules(…)`; a wrapper `div` with an `ag-theme-*` class or a `theme` grid option.

## Concepts

| Feature id              | AG Grid                                                            | argus-table                                                   | Fit     | Notes                                                                           |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `sorting`               | `sortable` (on by default), `sort: 'asc'`, `onSortChanged`         | `sortable: true`, `sorting`, `argus-sorting-change`           | maps    | Sorting is on for every AG Grid column by default: add `sortable: true` to each |
| `multi-sort`            | Shift+click, `multiSortKey`, `sortIndex`                           | `sorting` with several items, set by the app                  | partial | A header click sorts by that column alone                                       |
| `filters`               | `filter: 'agTextColumnFilter'` / `Number` / `Date` / `Set`         | `filter: 'text' / 'number' / 'date' / 'set'`, header-menu     | maps    | Users filter from the column menu                                               |
| `floating-filters`      | `floatingFilter: true`                                             | none                                                          | gap     | [gaps.md](../gaps.md#filter-row)                                                |
| `quick-filter`          | `quickFilterText`                                                  | `quickFilter`                                                 | maps    |                                                                                 |
| `selection`             | `rowSelection`, `checkboxSelection`, `onSelectionChanged`          | `selectionMode`, `selectionCheckboxes`, `selection`           | maps    | `getSelectedRows()` → map `selection` ids to rows                               |
| `row-id`                | `getRowId: (p) => p.data.id`                                       | `getRowId: (row) => row.id`                                   | maps    | Gets the row, not params                                                        |
| `pinned-columns`        | `pinned: 'left' / 'right'`                                         | `pin: 'start' / 'end'`, `columnPinning`                       | maps    | Logical sides: mirrored in RTL                                                  |
| `pinned-rows`           | `pinnedTopRowData`, `pinnedBottomRowData`                          | `pinnedRows: { top, bottom }`                                 | maps    |                                                                                 |
| `resizing`              | `resizable`, `onColumnResized`                                     | `resizable` (on by default), `argus-column-resize-end`        | maps    |                                                                                 |
| `flex`                  | `flex: 1`                                                          | `width: { flex: 1 }`                                          | maps    |                                                                                 |
| `movable`               | `suppressMovable`, `onColumnMoved`                                 | `reorderable: false`, `columnOrder`                           | maps    | Moving is on by default in both                                                 |
| `hide`                  | `hide: true`                                                       | `hidden: true`, `columnVisibility`                            | maps    |                                                                                 |
| `infinite`              | `rowModelType: 'infinite'`, `datasource.getRows`                   | `dataSource.getRows`                                          | maps    | `startRow`/`endRow` → `start`/`end`; return `{ rows, total }`                   |
| `server-side-row-model` | `rowModelType: 'serverSide'`, `serverSideDatasource`               | `dataSource`                                                  | partial | Flat rows only: no server-side grouping or tree                                 |
| `viewport`              | `rowModelType: 'viewport'`                                         | none                                                          | gap     | [gaps.md](../gaps.md#viewport)                                                  |
| `pagination`            | `pagination: true`, `paginationPageSize`                           | none: the table scrolls                                       | gap     | [gaps.md](../gaps.md#pagination)                                                |
| `editing`               | `editable`, `cellEditor`, `onCellValueChanged`                     | none                                                          | gap     | [gaps.md](../gaps.md#editing)                                                   |
| `row-grouping`          | `rowGroup`, `aggFunc`, `pivot`                                     | none                                                          | gap     | [gaps.md](../gaps.md#row-grouping)                                              |
| `tree-data`             | `treeData`, `getDataPath`                                          | none                                                          | gap     | [gaps.md](../gaps.md#tree-data)                                                 |
| `master-detail`         | `masterDetail`, `detailCellRenderer`                               | none                                                          | gap     | [gaps.md](../gaps.md#master-detail)                                             |
| `range-selection`       | `cellSelection` / `enableRangeSelection`, fill handle, clipboard   | none                                                          | gap     | [gaps.md](../gaps.md#range-selection)                                           |
| `row-drag`              | `rowDrag`                                                          | none                                                          | gap     | [gaps.md](../gaps.md#row-drag)                                                  |
| `context-menu`          | `getContextMenuItems`                                              | none on cells; the column menu on headers                     | gap     | [gaps.md](../gaps.md#context-menu)                                              |
| `side-bar-status-bar`   | `sideBar`, `statusBar`                                             | none                                                          | gap     | [gaps.md](../gaps.md#tool-panels)                                               |
| `spanning`              | `colSpan`, `rowSpan`, `spanRows`                                   | none in the body                                              | gap     | [gaps.md](../gaps.md#cell-spanning)                                             |
| `column-groups`         | `children: [...]` in `columnDefs`                                  | flat `columns` + `columnGroups`                               | maps    |                                                                                 |
| `row-height`            | `rowHeight`, `getRowHeight`, `autoHeight`, `wrapText`              | `rowHeight`, `density`; `wrap` with `rowHeight: 'auto'`       | maps    | One height for all rows, or `'auto'` to fit content                             |
| `dom-layout`            | `domLayout: 'autoHeight'`                                          | a fixed height                                                | partial | The table needs a bounded height to virtualize                                  |
| `cell-renderer`         | `cellRenderer`, `valueGetter`, `valueFormatter`, `headerComponent` | `cell`, `accessor` (function), `header`                       | maps    |                                                                                 |
| `events`                | `onRowClicked`, `onCellClicked`                                    | `argus-row-click`, `argus-cell-click`                         | maps    | No double-click event: listen for `dblclick` on cell content                    |
| `export`                | `exportDataAsCsv()`, `exportDataAsExcel()`                         | `@argus-table/export`: `downloadTable(table, 'csv' / 'xlsx')` | maps    |                                                                                 |
| `theme`                 | `ag-theme-quartz`, `themeQuartz`                                   | `@argus-table/themes`                                         | maps    | [styling.md](../styling.md#picking-a-theme-when-migrating)                      |
| `transactions`          | `applyTransaction({ add, update, remove })`                        | a new `data` array                                            | partial | Build the new array; row ids keep selection and widths                          |
| `overlays`              | `overlayNoRowsTemplate`, `noRowsOverlayComponent`                  | the `empty` slot                                              | maps    | `<div slot="empty">No orders</div>` inside the table                            |
| `locale`                | `localeText`                                                       | `labels` (and the add-ons' `labels`)                          | maps    |                                                                                 |
| `row-class`             | `getRowClass`, `rowClassRules`, `cellClassRules`, `cellStyle`      | `cell` content with classes; parts for row states             | partial | No per-row class on the row itself                                              |
| `state`                 | `initialState`, `api.getState()`                                   | `getState()`, `setState()`                                    | maps    |                                                                                 |

## Columns

| AG Grid `ColDef`                                              | argus-table `ColumnDef`                                                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `field: 'country'`                                            | `id: 'country', accessor: 'country'`                                                                                        |
| `field: 'athlete.name'`                                       | `accessor: 'athlete.name'`                                                                                                  |
| `colId` + `valueGetter: (p) => p.data.a + p.data.b`           | `id`, `accessor: (row) => row.a + row.b`                                                                                    |
| `headerName: 'Country'`                                       | `header: 'Country'`                                                                                                         |
| `width: 150`, `minWidth`, `maxWidth`                          | the same                                                                                                                    |
| `flex: 1`                                                     | `width: { flex: 1 }`                                                                                                        |
| `pinned: 'left'`                                              | `pin: 'start'`                                                                                                              |
| `hide: true`                                                  | `hidden: true`                                                                                                              |
| `sortable: false` (or default on)                             | `sortable: true` where it should sort                                                                                       |
| `filter: 'agNumberColumnFilter'`                              | `filter: 'number'`                                                                                                          |
| `filter: 'agSetColumnFilter'`, `filterParams.values`          | `filter: 'set'`, `filterOptions`                                                                                            |
| `type: 'numericColumn'`, `cellClass: 'ag-right-aligned-cell'` | `align: 'end'`                                                                                                              |
| `valueFormatter: (p) => fmt(p.value)`                         | `cell: (row, ctx) => fmt(ctx.value)`                                                                                        |
| `cellRenderer: StatusBadge` (component)                       | `cell: (row) => <StatusBadge value={row.status} />` (React), a `#cell-status` slot (Vue), an `argusCell` template (Angular) |
| `cellRenderer: 'agGroupCellRenderer'`                         | a gap (grouping)                                                                                                            |
| `wrapText: true, autoHeight: true`                            | `wrap: true` and the table's `rowHeight: 'auto'`                                                                            |
| `suppressMovable: true`                                       | `reorderable: false`                                                                                                        |
| `lockPinned: true`                                            | `pinnable: false`                                                                                                           |
| `checkboxSelection: true`                                     | delete it: `selectionCheckboxes` on the table                                                                               |
| `defaultColDef: { sortable, resizable, filter }`              | spread a shared object into each column: `{ ...defaults, id, … }`                                                           |

## State and events

- `onGridReady={(e) => setApi(e.api)}` and `gridRef.current.api.…` → a ref to the table element: `scrollToRow`, `getState`, `setState`, `refresh`.
- `api.setGridOption('rowData', rows)` / `applyTransaction` → a new `data` array.
- `api.getSelectedRows()` → `selection` mapped to rows. `onSelectionChanged` → `onSelectionChange` (`e.detail.selection`, ids).
- `onSortChanged` + `api.getColumnState()` → `onSortingChange` (`e.detail.sorting`).
- `onColumnResized` (with `finished`) → `onColumnResizeEnd`.
- `api.ensureIndexVisible(i)` → `scrollToRow(i, { align: 'nearest' })`; `ensureColumnVisible` → `scrollToColumn(id)`.
- `api.sizeColumnsToFit()` / `autoSizeAllColumns()` → `width: { flex }` on the columns / `autosizeColumns()`.
- `infinite` datasource: `getRows({ startRow, endRow, sortModel, filterModel, successCallback })` → `getRows({ start, end, sorting, filters, signal })` returning `{ rows, total }`; `lastRow` → `total`.

## Example

```tsx
// Before
const columnDefs: ColDef<Order>[] = [
  { field: 'id', headerName: 'Order', pinned: 'left', checkboxSelection: true, width: 110 },
  { field: 'customer', flex: 1, filter: 'agTextColumnFilter' },
  { field: 'total', type: 'numericColumn', valueFormatter: (p) => money(p.value) },
];
<div className="ag-theme-quartz" style={{ height: 600 }}>
  <AgGridReact
    rowData={orders}
    columnDefs={columnDefs}
    rowSelection={{ mode: 'multiRow' }}
    getRowId={(p) => p.data.id}
    pagination
    onRowClicked={(e) => open(e.data)}
  />
</div>;

// After
const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', pin: 'start', width: 110, sortable: true },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    align: 'end',
    sortable: true,
    cell: (o) => money(o.total),
  },
];
const plugins = [headerMenu<Order>()];
const getRowId = (o: Order) => o.id;
<ArgusTable
  aria-label="Orders"
  style={{ height: 600 }}
  columns={columns}
  data={orders}
  getRowId={getRowId}
  plugins={plugins}
  selectionMode="multi"
  selectionCheckboxes
  onRowClick={(e) => open(e.detail.row)}
/>;
```

Pagination went away: the table scrolls through all orders. Tell the user (B2).

## Gaps

Floating filters, viewport row model, pagination, editing, row grouping and pivoting, tree data, master/detail, range selection and clipboard, row dragging, cell context menus, side bar and status bar, cell spanning. Server-side row model only as flat rows. See [gaps.md](../gaps.md).

## Remove

`ag-grid-react` / `ag-grid-vue3` / `ag-grid-angular`, `ag-grid-community`, `ag-grid-enterprise` (and the licence key setup), `ModuleRegistry.registerModules`, AG Grid CSS imports (`ag-grid.css`, `ag-theme-*.css`) and `ag-theme-*` wrapper classes, custom CSS targeting `.ag-*`.

## Behaviour differences

- Columns don't sort unless `sortable: true` (AG Grid sorts every column by default).
- Shift+click doesn't add a sort column.
- Filtering is in the column menu (`headerMenu()`), not a filter icon menu per AG Grid filter type; filter models are `{ kind, op, value }` objects.
- No pagination: one scrolling list.
- Keyboard: arrow keys, Home/End, PageUp/PageDown, Enter (fires row/cell click), Space (selects); no editing keys.
- Row height is one value (or `'auto'` per content), set by `density` or `rowHeight`.
