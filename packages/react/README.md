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

- **Props** set the element's properties: `columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `rowHeight`, `density`, `overscan`, `sorting`, `columnSizing` and `columnOrder`. Other props (`aria-label`, `className`, `style`, …) go to the element as usual.
- **Events** are `on*` props that get the element's `CustomEvent`: `onSortChange`, `onColumnResize`, `onColumnReorder`, `onCellClick`, `onRowClick`, `onRangeChange` and `onLoadError`. The details are in the [`argus-table` README](https://www.npmjs.com/package/argus-table).
- **Cells:** a column's `cell` function returns a string, a number, a DOM node or a Lit template. React elements in cells are planned.
- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.

## Controlled state

`sorting`, `columnSizing` and `columnOrder` work like a controlled input. Leave the prop out and the table keeps the state itself. Set it, and the table shows what you pass and only proposes changes through the event:

```tsx
const [sorting, setSorting] = useState<SortState>([]);

<ArgusTable
  columns={columns}
  data={orders}
  sorting={sorting}
  onSortChange={(e) => setSorting(e.detail.sorting)}
/>;
```

## Methods

A `ref` gives you the element, with `refresh()`, `scrollToRow(index)` and `autosizeColumns(ids?)`:

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
