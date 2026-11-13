# @argus-table/react

React components for [`<argus-table>`](https://www.npmjs.com/package/argus-table): `<ArgusTable>` and `<ArgusColumn>`, with typed props and typed events. The row type is inferred from `data`.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i @argus-table/react @argus-table/themes
```

`argus-table` comes with it. React 18.3 or 19 is a peer dependency.

## A first table

```tsx
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import '@argus-table/themes/default.css';

interface Order {
  id: string;
  customer: string;
  total: number;
}

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

export function Orders({ orders }: { orders: Order[] }) {
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ height: 400 }}
      columns={columns}
      data={orders}
      getRowId={(order) => order.id}
      onRowClick={(e) => console.log(e.detail.row)} // e.detail.row is an Order
    />
  );
}
```

- **Props** set the element's properties: `columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `rowHeight`, `density`, `overscan`, `virtualizeColumns`, `sorting`, `columnSizing`, `columnOrder`, `selectionMode`, `selectionCheckboxes`, `selection` and `plugins`. Other props (`aria-label`, `className`, `style`, …) go to the element as usual.
- **Events** are `on*` props that get the element's `CustomEvent`: `onSortingChange`, `onColumnSizingChange`, `onColumnOrderChange`, `onColumnPinningChange`, `onColumnVisibilityChange`, `onColumnFiltersChange`, `onSelectionChange`, `onCellClick`, `onRowClick`, `onRangeChange` and `onLoadError`. A `…Change` event has the new value in `e.detail` under the property's name. The details are in the [`argus-table` README](https://www.npmjs.com/package/argus-table).
- **Cells and headers** can be JSX: a column's `cell` (and `header`) may return any React node, as well as a string, a number, a DOM node or a Lit template. See [React content in cells](#react-content-in-cells).
- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.

## React content in cells

```tsx
import { ArgusTable, type ReactColumnDef } from '@argus-table/react';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: <b>Order</b>, accessor: 'id', width: 90 },
  { id: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
  { id: 'total', header: 'Total', cell: (o, ctx) => <Money value={o.total} row={ctx.rowId} /> },
];

<ArgusTable columns={columns} data={orders} />;
```

- `cell(row, context)` gets the row and `{ rowId, index, columnId, value, pinned? }`; `header` is a node or a function returning one. `<ArgusColumn>` takes JSX in `header` and `cell` too.
- The content renders through portals in your component tree, so it sees your providers (theme, router, store, i18n) like any other child.
- Cells are pooled: as the table scrolls, a cell shows another row, and its component **updates with new props instead of remounting**. Keep per-row state in your data (or keyed by `context.rowId`), not in a cell component's own state. Effects with `[]` dependencies run once per pooled cell, not once per row.
- Content commits synchronously before the browser paints and before `width: 'auto'` measures, so there is no flash of empty cells.
- `react-dom` is a peer dependency (portals). Columns hold functions, so define them outside the component or in `useMemo`.

## Controlled state

`sorting`, `columnSizing`, `columnOrder` and `selection` work like a controlled input. Leave the prop out and the table keeps the state itself. Set it, and the table shows what you pass and only proposes changes through the event:

```tsx
const [sorting, setSorting] = useState<SortState>([]);

<ArgusTable
  columns={columns}
  data={orders}
  sorting={sorting}
  onSortingChange={(e) => setSorting(e.detail.sorting)}
/>;
```

Every controllable property works the same way, for example selected rows with `selectionMode="multi"`, `selection` and `onSelectionChange` (`e.detail.selection`, row ids). To save column widths once a resize is done, rather than on every frame of a drag, use `onColumnResizeEnd` (`e.detail.columnSizing`).

## Formula columns

With `formulas()` from [`@argus-table/formulas`](https://www.npmjs.com/package/@argus-table/formulas) in `plugins`, the formula editor proposes column changes through `onFormulaColumnAdd`, `onFormulaColumnChange` and `onFormulaColumnRemove`. The table doesn't change its columns: apply `e.detail.columns`, which holds your React columns.

```tsx
const [columns, setColumns] = useState<readonly ReactColumnDef<Order>[]>(initialColumns);
const apply = (e: CustomEvent<FormulaColumnDetail<Order>>) => setColumns(e.detail.columns);

<ArgusTable
  columns={columns}
  data={orders}
  plugins={plugins}
  onFormulaColumnAdd={apply}
  onFormulaColumnChange={apply}
  onFormulaColumnRemove={apply}
/>;
```

## Methods

A `ref` gives you the element, with `refresh()`, `scrollToRow(index)`, `autosizeColumns(ids?)`, and `getState()` / `setState(state)` to save and restore a user's layout (sorting, widths, order, pinning, hidden columns, filters, selection and scroll position):

```tsx
const table = useRef<ArgusTableElement<Order>>(null);

<ArgusTable ref={table} columns={columns} data={orders} />;
// later
await table.current?.scrollToRow(0);
```

## Columns as children

`<ArgusColumn>` renders an `<argus-column>`, so columns can come from a `.map()`. Changing, adding, removing or moving one keeps the widths, the order and the sort:

```tsx
<ArgusTable<Order> data={orders}>
  <ArgusColumn columnId="id" header="Order" accessor="id" width={90} pin="start" />
  <ArgusColumn<Order> columnId="total" header="Total" accessor={(o) => o.total} sortable />
</ArgusTable>
```

A non-empty `columns` prop wins over the children.

## Server rendering

The modules start with `'use client'`, so they work in React Server Components apps such as the Next.js App Router. On the server the table renders as an empty `<argus-table>` and fills in once the browser has loaded it.

## License

MIT
