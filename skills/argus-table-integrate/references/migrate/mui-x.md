# From MUI X Data Grid

Covers `@mui/x-data-grid`, `-pro` and `-premium` (v6 to v9). The free version's 100-row page limit and Pro's licence go away; Premium's grouping, aggregation and Excel features mostly have no equivalent.

## Detect

`<DataGrid`, `<DataGridPro`, `<DataGridPremium`; columns typed `GridColDef[]` with `field` and `headerName`; `useGridApiRef()`.

## Concepts

| Feature id           | MUI X                                                                  | argus-table                                                            | Fit     | Notes                                                                              |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `sorting`            | sortable by default, `sortModel`, `onSortModelChange`                  | `sortable: true`, `sorting`, `onSortingChange`                         | maps    | `[{ field, sort: 'asc' }]` → `[{ id, desc: false }]`                               |
| `server-mode`        | `sortingMode` / `filterMode` / `paginationMode="server"`, `dataSource` | `dataSource` with `getRows`                                            | maps    | [server-data.md](../server-data.md)                                                |
| `pagination`         | `paginationModel`, `pageSizeOptions`                                   | none: the table scrolls                                                | gap     | [gaps.md](../gaps.md#pagination)                                                   |
| `checkbox-selection` | `checkboxSelection`, `rowSelectionModel`                               | `selectionMode="multi"`, `selectionCheckboxes`, `selection`            | maps    | v8's `{ type, ids: Set }` model → an array of ids                                  |
| `row-id`             | `getRowId` (default: `row.id`)                                         | `getRowId` (default: the index)                                        | maps    | Always pass `getRowId={(r) => String(r.id)}`                                       |
| `column-types`       | `type: 'number' / 'date' / 'singleSelect' / 'boolean'`, `valueOptions` | `align: 'end'`, `filter: 'number' / 'date' / 'set'`, `filterOptions`   | maps    | No implicit formatting: format in `cell`                                           |
| `filters`            | `filterModel`, `filterOperators`                                       | `columnFilters`, `filter`, `filterFn`, header-menu                     | maps    |                                                                                    |
| `render-cell`        | `renderCell`, `valueGetter`, `valueFormatter`, `renderHeader`          | `cell`, `accessor` (function), `header`                                | maps    |                                                                                    |
| `column-pinning`     | `pinnedColumns: { left, right }`                                       | `pin`, `columnPinning`                                                 | maps    |                                                                                    |
| `pinned-rows`        | `pinnedRows: { top, bottom }`                                          | `pinnedRows: { top, bottom }`                                          | maps    | Same shape                                                                         |
| `visibility`         | `columnVisibilityModel`                                                | `columnVisibility`                                                     | maps    | Same shape                                                                         |
| `column-grouping`    | `columnGroupingModel`                                                  | `columnGroups`                                                         | maps    | `{ groupId, headerName, children: [{ field }] }` → `{ id, header, columns: [id] }` |
| `resizing`           | `resizable`, `onColumnWidthChange`                                     | `resizable`, `argus-column-resize-end`                                 | maps    |                                                                                    |
| `flex`               | `flex: 1`                                                              | `width: { flex: 1 }`                                                   | maps    |                                                                                    |
| `reorder`            | `columnOrder` / `onColumnOrderChange`, `disableColumnReorder`          | `columnOrder`, `reorderable: false`                                    | maps    |                                                                                    |
| `toolbar`            | `GridToolbar`, `showToolbar`, quick filter, export buttons             | the app's toolbar: a search input → `quickFilter`, `downloadTable`     | partial | Build the toolbar outside the table                                                |
| `auto-height`        | `autoHeight`                                                           | a fixed height                                                         | partial | The table needs a bounded height                                                   |
| `row-height`         | `rowHeight`, `getRowHeight: () => 'auto'`                              | `rowHeight`, `rowHeight: 'auto'` with `wrap`                           | maps    |                                                                                    |
| `density`            | `density="compact" / "standard" / "comfortable"`                       | `density="compact" / "comfortable" / "spacious"`                       | maps    | `standard` → `comfortable`, `comfortable` → `spacious`                             |
| `events`             | `onRowClick`, `onCellClick`                                            | `onRowClick`, `onCellClick`                                            | maps    | `params.row` → `e.detail.row`                                                      |
| `editing`            | `editable`, `editMode`, `processRowUpdate`                             | none                                                                   | gap     | [gaps.md](../gaps.md#editing)                                                      |
| `grouping-tree`      | `rowGroupingModel`, `aggregationModel`, `treeData`                     | none                                                                   | gap     | [gaps.md](../gaps.md#row-grouping)                                                 |
| `detail-panel`       | `getDetailPanelContent`                                                | none                                                                   | gap     | [gaps.md](../gaps.md#master-detail)                                                |
| `cell-selection`     | `cellSelection`, clipboard                                             | none                                                                   | gap     | [gaps.md](../gaps.md#range-selection)                                              |
| `row-reorder`        | `rowReordering`                                                        | none                                                                   | gap     | [gaps.md](../gaps.md#row-drag)                                                     |
| `header-filters`     | `headerFilters`                                                        | none                                                                   | gap     | [gaps.md](../gaps.md#filter-row)                                                   |
| `export`             | `csvOptions`, `printOptions`, `excelOptions`, `apiRef.exportDataAsCsv` | `@argus-table/export`                                                  | maps    | CSV, XLSX and PDF                                                                  |
| `locale`             | `localeText`                                                           | `labels`                                                               | maps    |                                                                                    |
| `slots`              | `slots.noRowsOverlay`, `loadingOverlay`                                | the `empty` slot; skeleton rows while a `dataSource` loads             | maps    |                                                                                    |
| `loading`            | `loading` prop                                                         | a `dataSource` shows loading rows                                      | partial | With `data`, show your own spinner over the table while fetching                   |
| `api-ref`            | `useGridApiRef()`, `apiRef.current.scrollToIndexes`                    | a ref to the element: `scrollToRow`, `getState`, `setState`, `refresh` | partial | Fewer methods                                                                      |

## Columns

| `GridColDef`                                            | `ColumnDef`                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `field: 'age'`                                          | `id: 'age', accessor: 'age'`                                           |
| `headerName: 'Age'`                                     | `header: 'Age'`                                                        |
| `width`, `minWidth`, `maxWidth`, `flex`                 | `width`, `minWidth`, `maxWidth`, `width: { flex }`                     |
| `type: 'number'`                                        | `align: 'end'`, `filter: 'number'`, a `cell` that formats              |
| `type: 'date'` (with `valueGetter: (v) => new Date(v)`) | `filter: 'date'`, `accessor` returning the date, a `cell` that formats |
| `type: 'singleSelect', valueOptions: [...]`             | `filter: 'set'`, `filterOptions: [...]`                                |
| `valueGetter: (value, row) => …` (v7+)                  | `accessor: (row) => …`                                                 |
| `valueFormatter: (value) => …`                          | `cell: (row, ctx) => fmt(ctx.value)`                                   |
| `renderCell: (params) => <Chip label={params.value} />` | `cell: (row, ctx) => <Chip label={ctx.value} />`                       |
| `renderHeader`                                          | `header: () => <…/>`                                                   |
| `sortable: false`                                       | leave out `sortable`; others need `sortable: true`                     |
| `filterable: false`                                     | leave out `filter`                                                     |
| `hideable: false`, `resizable: false`                   | the same                                                               |
| `align: 'right'`, `headerAlign`                         | `align: 'end'`                                                         |
| `disableColumnMenu: true`                               | no `headerMenu()`, or turn its items off                               |
| `type: 'actions', getActions`                           | `id: 'actions'`, `cell` rendering the buttons, `pin: 'end'`            |

Defaults MUI turns on without a prop, so the scan doesn't list them:

- **The column menu** (sort, filter, hide, manage columns): add `@argus-table/header-menu` (`plugins: [headerMenu()]`) unless the grid had `disableColumnMenu`.
- **Client-side filtering** (`filterMode` defaults to `client`, even with server pagination): with a `dataSource`, filters go to the server in `getRows`. If the API can't filter, leave out the columns' `filter` kinds and say so in the gap review.
- **The footer** with the row count, page controls and "N rows selected": render the count and the selection next to the table (with a `dataSource`, keep the `total` from `getRows`; see [server-data.md](../server-data.md)).
- **Row heights:** `compact` / `standard` / `comfortable` are 36 / 52 / 67px. For the same height set `rowHeight` (`rowHeight={36}`).

## State and events

- `sortModel` → `sorting`: `[{ field: 'age', sort: 'desc' }]` → `[{ id: 'age', desc: true }]`.
- `rowSelectionModel` → `selection` (array of string ids); `onRowSelectionModelChange` → `onSelectionChange`.
- `filterModel.quickFilterValues` → `quickFilter` (joined with spaces).
- `columnVisibilityModel` / `onColumnVisibilityModelChange` → `columnVisibility` / `onColumnVisibilityChange`.
- Server mode: the effect that fetches on `paginationModel` / `sortModel` / `filterModel` changes becomes `getRows` in a `dataSource`; `rowCount` → `total`. The pagination, sort model and loading state that only drove the fetch go away (keep `sorting` bound only if the app shows or saves it).
- `apiRef.current.exportState()` / `restoreState()` → `getState()` / `setState()`.

## Example

```tsx
// Before
<DataGridPro
  rows={rows}
  columns={columns}
  rowCount={total}
  loading={loading}
  paginationMode="server"
  sortingMode="server"
  paginationModel={paginationModel}
  onPaginationModelChange={setPaginationModel}
  sortModel={sortModel}
  onSortModelChange={setSortModel}
  checkboxSelection
  density="compact"
/>;

// After
const PAGE = 50; // the API's page size
const usersSource: DataSource<User> = {
  pageSize: PAGE,
  async getRows({ start, sorting, signal }) {
    const page = start / PAGE; // pages are aligned to pageSize
    const sort = sorting[0] ? `${sorting[0].id},${sorting[0].desc ? 'desc' : 'asc'}` : '';
    const res = await fetch(`/api/users?page=${String(page)}&size=${String(PAGE)}&sort=${sort}`, {
      signal,
    });
    const body = await res.json();
    return { rows: body.items, total: body.total };
  },
};
<ArgusTable
  aria-label="Users"
  columns={columns}
  dataSource={usersSource}
  getRowId={getRowId}
  selectionMode="multi"
  selectionCheckboxes
  density="compact"
/>;
```

## Gaps

Pagination, editing, row grouping, aggregation and tree data, detail panels, cell selection and clipboard, row reordering, header filters. See [gaps.md](../gaps.md).

## Remove

`@mui/x-data-grid*`, the licence key (`LicenseInfo.setLicenseKey`), `GridToolbar` imports, `sx` styling aimed at `.MuiDataGrid-*`. Keep `@mui/material` (the app uses it).

## Behaviour differences

- Columns sort only with `sortable: true` (MUI sorts every column by default).
- No pages: everything scrolls; the free MUI grid's 100-row page cap is gone.
- The column menu (`headerMenu()`) differs from MUI's: sort, filter, pin, fit width, hide.
- Theme: `material` is closest; MUI's own theme (palette, typography) isn't read automatically. Map `theme.palette` colours to tokens, or make a theme with the `argus-table-theme` skill.
