# From TanStack Table

Covers `@tanstack/react-table`, `@tanstack/vue-table`, `@tanstack/angular-table` and `@tanstack/table-core` (v8 and v9), including the shadcn/ui `data-table.tsx` pattern. TanStack Table is headless: the app renders the `<table>`, so migrating replaces both the table instance and the markup.

## Detect

`useReactTable(`, `useVueTable(`, `createAngularTable(`, `createTable(`, and in v9 `useTable(` / `useLegacyTable(` with features such as `rowSortingFeature` and row models such as `createSortedRowModel()`; column files use `ColumnDef<T>`, `accessorKey`, `accessorFn`, `createColumnHelper()`; markup uses `flexRender`. A shared `DataTable` component that takes `columns` and `data` is the usual shape: migrate it once, keep its props, and convert the column files.

## Concepts

| Feature id          | TanStack Table                                                                 | argus-table                                                        | Fit     | Notes                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sorting`           | `getSortedRowModel()`, `state.sorting`, `onSortingChange`                      | `sortable: true` per column; `sorting` + `argus-sorting-change`    | maps    | `SortingState` is already `{ id, desc }[]`; it carries over as `SortState`                                                                                                   |
| `multi-sort`        | `enableMultiSort`, Shift+click                                                 | `sorting` with several items, set by the app                       | partial | A header click sorts by that column alone                                                                                                                                    |
| `column-filters`    | `columnFilters`, `onColumnFiltersChange`, `filterFn`, `columnFilteringFeature` | `filter` kind per column, `filterFn`, `columnFilters`, header-menu | maps    | Filters are `{ kind, op, value }` objects, not raw values (below). `getFilteredRowModel()` alone only serves a global filter: then there are no column filters to carry over |
| `global-filter`     | `globalFilter`, `onGlobalFilterChange`                                         | `quickFilter`                                                      | maps    | Every word must appear in some shown column                                                                                                                                  |
| `faceted`           | `getFacetedUniqueValues()`                                                     | `filter: 'set'` (lists the distinct values itself)                 | maps    | With a `dataSource`, `filterOptions`                                                                                                                                         |
| `pagination`        | `getPaginationRowModel()`, page buttons                                        | none: the table scrolls                                            | gap     | [gaps.md](../gaps.md#pagination)                                                                                                                                             |
| `server-side`       | `manualPagination` / `manualSorting` / `manualFiltering`, `rowCount`           | `dataSource` with `getRows`                                        | maps    | [server-data.md](../server-data.md)                                                                                                                                          |
| `row-selection`     | `rowSelection` (`{ [id]: true }`), checkbox column                             | `selectionMode`, `selectionCheckboxes`, `selection` (`string[]`)   | maps    | Convert the record to an array of ids; drop the hand-made checkbox column                                                                                                    |
| `row-id`            | `getRowId`                                                                     | `getRowId`                                                         | maps    | Must return a string                                                                                                                                                         |
| `resizing`          | `enableColumnResizing`, `columnSizing`, `size` / `minSize` / `maxSize`         | `resizable`, `width` / `minWidth` / `maxWidth`, `columnSizing`     | maps    | Resizing is on by default; save widths on `argus-column-resize-end`                                                                                                          |
| `column-pinning`    | `columnPinning: { left, right }`                                               | `pin: 'start' / 'end'`, `columnPinning`                            | maps    | `{ left: ['a'] }` → `{ a: 'start' }`                                                                                                                                         |
| `row-pinning`       | `rowPinning`                                                                   | `pinnedRows: { top, bottom }`                                      | partial | Pinned rows are separate objects, not data rows                                                                                                                              |
| `column-order`      | `columnOrder`                                                                  | `columnOrder`                                                      | maps    | Users can also drag headers                                                                                                                                                  |
| `column-visibility` | `columnVisibility`                                                             | `columnVisibility`, `hidden`                                       | maps    | Same shape: `{ id: false }` hides                                                                                                                                            |
| `column-groups`     | `columnHelper.group()`, nested `columns`                                       | flat `columns` + `columnGroups`                                    | maps    | Groups move to a separate array of ids                                                                                                                                       |
| `grouping`          | `getGroupedRowModel()`, `aggregationFn`                                        | none                                                               | gap     | [gaps.md](../gaps.md#row-grouping)                                                                                                                                           |
| `expanding`         | `getExpandedRowModel()`, `getSubRows`, sub-components                          | none                                                               | gap     | [gaps.md](../gaps.md#tree-data), [master-detail](../gaps.md#master-detail)                                                                                                   |
| `virtualizer`       | `@tanstack/*-virtual` around the rows                                          | built in                                                           | builtin | Delete the virtualizer, the scroll container and the padding rows                                                                                                            |
| `footer`            | `footer`, `getFooterGroups()`                                                  | `pinnedRows.bottom`                                                | partial | A footer becomes a totals row object                                                                                                                                         |
| `editing`           | `meta.updateData` with inputs in cells                                         | none built in                                                      | gap     | [gaps.md](../gaps.md#editing): inputs in `cell` still work                                                                                                                   |
| `cell-selection`    | `cellSelectionFeature` (v9)                                                    | none                                                               | gap     | [gaps.md](../gaps.md#range-selection)                                                                                                                                        |
| `cell-spanning`     | `cellSpanningFeature` (v9)                                                     | none                                                               | gap     | [gaps.md](../gaps.md#cell-spanning)                                                                                                                                          |
| `flex-render`       | `flexRender(column.columnDef.cell, ctx)` in the markup                         | `cell` / `header` returning content                                | maps    | The table renders headers and cells; delete the `<table>` markup                                                                                                             |

## Columns

| TanStack                                            | argus-table                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `accessorKey: 'email'`                              | `id: 'email', accessor: 'email'`                                                                |
| `accessorKey: 'customer.name'`                      | `accessor: 'customer.name'` (a path), `id: 'customerName'`                                      |
| `accessorFn: (row) => …`, `id: 'x'`                 | `accessor: (row) => …` (defined once), `id: 'x'`                                                |
| `header: 'Email'`                                   | `header: 'Email'`                                                                               |
| `header: ({ column }) => <Button …/>` (sort toggle) | `header: 'Email', sortable: true`: the table renders the sort button, indicator and `aria-sort` |
| `cell: ({ row }) => row.getValue('amount')`         | `cell: (row) => row.amount` (the row object itself)                                             |
| `cell: ({ getValue }) => fmt(getValue())`           | `cell: (row, ctx) => fmt(ctx.value)`                                                            |
| `size: 120`, `minSize`, `maxSize`                   | `width: 120`, `minWidth`, `maxWidth`                                                            |
| `enableSorting: false`                              | leave out `sortable` (it's off by default)                                                      |
| `enableHiding: false`                               | `hideable: false`                                                                               |
| `enableResizing: false`                             | `resizable: false`                                                                              |
| `enableColumnFilter`, `filterFn: 'includesString'`  | `filter: 'text'`                                                                                |
| `meta: { align: 'right' }` (custom)                 | `align: 'end'`                                                                                  |
| `id: 'select'` checkbox column                      | delete it: `selectionCheckboxes`                                                                |
| `id: 'actions'` column                              | keep it: `id: 'actions'`, `cell` with the menu, `pin: 'end'`, `reorderable: false`              |

`cell` gets the row object, not TanStack's `CellContext`: `row.original.x` → `row.x`, `row.getValue('x')` → `ctx.value` or `row.x`.

## State and events

- `state: { sorting }` with `onSortingChange: setSorting` → keep the `useState`, bind `sorting` and `onSortingChange={(e) => setSorting(e.detail.sorting)}`; or drop both when only the table used it.
- `rowSelection` (`{ "3": true }`) → `selection` (`['3']`), `onSelectionChange={(e) => setSelection(e.detail.selection)}`. `table.getSelectedRowModel()` → map `selection` through your rows.
- `columnFilters` (`[{ id, value }]`) → `columnFilters` (`{ [id]: { kind: 'text', op: 'contains', value } }`).
- `globalFilter` → `quickFilter` (a plain prop; no event).
- `table.getRowModel().rows.length` → `data.length` (after filtering, the table announces the row count to screen readers itself).
- `onClick` on `<tr>` → `onRowClick` (`e.detail.row`).

## Example

```tsx
// Before: components/ui/data-table.tsx (shadcn)
export function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });
  return <Table>{/* header groups, rows, flexRender, pagination buttons */}</Table>;
}

// After
import { ArgusTable, type ReactColumnDef } from '@argus-table/react';

export function DataTable<T>({ columns, data, label }: { columns: ReactColumnDef<T>[]; data: T[]; label: string }) {
  return <ArgusTable<T> aria-label={label} style={{ height: 560 }} columns={columns} data={data} />;
}

// columns.tsx: before
{ accessorKey: 'email', header: ({ column }) => <Button onClick={() => column.toggleSorting()}>Email</Button> },
{ accessorKey: 'amount', header: () => <div className="text-right">Amount</div>, cell: ({ row }) => fmt(row.getValue('amount')) },
// after
{ id: 'email', header: 'Email', accessor: 'email', sortable: true, filter: 'text' },
{ id: 'amount', header: 'Amount', accessor: 'amount', align: 'end', sortable: true, cell: (p) => fmt(p.amount) },
```

## Gaps

Pagination (the table scrolls), grouping and aggregation, expanding sub-rows and sub-components, and editing. See [gaps.md](../gaps.md).

## Remove

`@tanstack/react-table` (or the Vue/Angular package) and `@tanstack/react-virtual` once nothing imports them; the shadcn `Table` primitives only if nothing else uses them; pagination components; sort-button headers.

## Behaviour differences

- argus-table renders the table: headers with sort indicators, a keyboard grid (arrow keys, Home/End, PageUp/PageDown), resizing and column reordering by drag (on by default; `reorderable: false` to turn it off).
- Columns don't sort unless `sortable: true`, as with TanStack's manual headers. A header click cycles ascending → descending → unsorted (a `toggleSorting(getIsSorted() === 'asc')` header only toggled).
- With `selectionMode`, a click anywhere on a row selects it, not only its checkbox; select-all selects every row the filters keep, not the current page.
- `quickFilter` keeps rows where every word appears in some shown column; TanStack's default global filter matched the whole text in one column.
- Rows are virtualized: only rows in view are in the DOM (tests: [testing.md](../testing.md)).
- Styling moves from the app's `<table>` classes (Tailwind on `TableRow`, `TableCell`) to a theme and tokens; content inside cells keeps its classes.
