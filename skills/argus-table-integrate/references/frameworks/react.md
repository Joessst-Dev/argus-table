# React: `@argus-table/react`

React 18.3 or 19. Install `@argus-table/react` and `argus-table` (and `@argus-table/themes`) at one version.

## Full example

```tsx file=src/Orders.tsx
import { useMemo, useRef, useState } from 'react';
import {
  ArgusTable,
  type ArgusTableElement,
  type ReactColumnDef,
  type SelectionState,
  type SortState,
} from '@argus-table/react';
import { headerMenu } from '@argus-table/header-menu';

export interface Order {
  id: string;
  customer: string;
  total: number;
  status: 'paid' | 'pending' | 'refunded';
}

const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

// Columns, plugins and getRowId hold functions: define them once, outside the component.
const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 110, pin: 'start', sortable: true },
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
    width: 120,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (order) => money.format(order.total),
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    sortable: true,
    filter: 'set',
    cell: (order) => <span className={`badge badge-${order.status}`}>{order.status}</span>,
  },
];
const plugins = [headerMenu<Order>()];
const getRowId = (order: Order) => order.id;

export function Orders({ orders, onOpen }: { orders: Order[]; onOpen: (order: Order) => void }) {
  const table = useRef<ArgusTableElement<Order>>(null);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortState>([{ id: 'id', desc: true }]);
  const [selection, setSelection] = useState<SelectionState>([]);
  const selectedTotal = useMemo(
    () => orders.filter((o) => selection.includes(o.id)).reduce((sum, o) => sum + o.total, 0),
    [orders, selection],
  );

  return (
    <section>
      <input
        type="search"
        aria-label="Search orders"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ArgusTable
        ref={table}
        aria-label="Orders"
        style={{ height: 480 }}
        columns={columns}
        data={orders}
        getRowId={getRowId}
        plugins={plugins}
        quickFilter={search}
        sorting={sorting}
        onSortingChange={(e) => setSorting(e.detail.sorting)}
        selectionMode="multi"
        selectionCheckboxes
        selection={selection}
        onSelectionChange={(e) => setSelection(e.detail.selection)}
        onRowClick={(e) => onOpen(e.detail.row)}
      />
      <p>
        {selection.length} selected, {money.format(selectedTotal)}
        <button onClick={() => void table.current?.scrollToRow(0)}>Back to top</button>
      </p>
    </section>
  );
}
```

## Props and events

- Props are the element's properties (`columns`, `data`, `dataSource`, `getRowId`, `sorting`, …: [api.md](../api.md#properties)). Other props (`aria-label`, `className`, `style`, `id`) go to the element.
- Events are `on<Name>` props that get the element's `CustomEvent`: `onSortingChange`, `onSelectionChange`, `onRowClick`, `onCellClick`, `onColumnResizeEnd`, … The value is in `e.detail`.
- Controlled state: pass the value and its handler together, or neither. One without the other freezes that state.

## Content in cells

- `cell` and `header` may return JSX (type columns as `ReactColumnDef<T>`). It renders through portals, so it sees context providers (theme, router, query client, i18n).
- Cells are pooled: a cell component gets new props as the table scrolls, it doesn't remount. Effects with `[]` run once per pooled cell, not per row. Keep per-row state in the data or keyed by `ctx.rowId`.
- Columns depending on props or state: `useMemo(() => [...], [deps])`. Event handlers used inside cells can be read from a ref to keep the columns stable.

## Refs and methods

`useRef<ArgusTableElement<T>>(null)` gives the element: `refresh()`, `scrollToRow(target, { align })`, `scrollToColumn(id)`, `autosizeColumns()`, `getState()`, `setState()`.

Saving a layout:

```tsx
useEffect(() => {
  const saved = localStorage.getItem('orders-table');
  if (saved) void table.current?.setState(JSON.parse(saved));
}, []);
const save = () => localStorage.setItem('orders-table', JSON.stringify(table.current?.getState()));
// onColumnResizeEnd={save} onSortingChange={save} onColumnOrderChange={save} …
```

## Columns as children

```tsx
import { ArgusColumn, ArgusTable } from '@argus-table/react';

<ArgusTable<Order> aria-label="Orders" data={orders}>
  <ArgusColumn columnId="id" header="Order" accessor="id" width={110} sortable />
  <ArgusColumn<Order>
    columnId="total"
    header="Total"
    accessor="total"
    align="end"
    cell={(o) => money.format(o.total)}
  />
</ArgusTable>;
```

`columns` wins over children when it isn't empty.

## Frameworks

- **Vite / CRA:** import the theme in `src/main.tsx`.
- **Next.js App Router:** `@argus-table/react` is a client module. A Server Component may render `<ArgusTable>` with plain data only; anything with functions goes into a `'use client'` file (see [pitfalls.md](../pitfalls.md#server-component-props)). Import the theme in `app/layout.tsx`. On the server the table is an empty element of its height.
- **Next.js Pages Router, Remix, React Router 7:** the table renders on the client; import the theme in `pages/_app.tsx` or `app/root.tsx`.
- **React 18:** use the wrapper, never `<argus-table>` in JSX (React 18 sets attributes, not properties).
