# Designing columns

How to turn a row type into good columns. Field reference: [api.md](api.md#columndef).

## From a row type

For each field users need to see, one column:

| The field is…                     | Column                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| the row's identity (order number) | `pin: 'start'`, a fixed `width`, `sortable: true`                                                            |
| a name or title                   | `width: { flex: 1 }` (takes the free space), `minWidth: 160`, `sortable: true`, `filter: 'text'`             |
| a number or money                 | `align: 'end'`, `sortable: true`, `filter: 'number'`, a `cell` that formats it                               |
| a date                            | `sortable: true`, `filter: 'date'` (ISO strings or `Date` values), a `cell` that formats it                  |
| a status or category              | `filter: 'set'`, a `cell` with a badge                                                                       |
| a boolean                         | `filter: 'set'`, a `cell` with a word or an icon (and its text for screen readers)                           |
| long text (a description)         | `wrap: true` with the table's `rowHeight: 'auto'`, or a fixed width and the default ellipsis                 |
| actions (edit, delete)            | `id: 'actions'`, no `accessor`, `sortable: false`, `pin: 'end'`, `reorderable: false`, a `cell` with buttons |

- **`id`** is a stable key: saved layouts, `sorting` and events use it. Usually the field name.
- **`accessor`** is what the column sorts, filters, searches and exports: the raw value. A path (`'customer.name'`) or a function (`(row) => row.price * row.qty`), defined once (not in a render).
- **`cell`** is what it shows: format there, keep `accessor` raw. A `cell` without an `accessor` shows content that doesn't sort or filter.
- **`header`**: short text. Function headers and framework content work; plain text is what exports and the column menu read.
- **Widths:** fixed px for short values, `{ flex: n }` for the columns that should take the rest, `'auto'` to fit the content of the first rows once. The default is 150px.

## Example

```ts
import type { ColumnDef } from 'argus-table';

interface Order {
  id: string;
  customer: { name: string };
  total: number;
  placed: string; // ISO date
  status: 'paid' | 'pending' | 'refunded';
}

const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });
const day = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 110, pin: 'start', sortable: true },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer.name',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    filter: 'text',
  },
  {
    id: 'placed',
    header: 'Placed',
    accessor: 'placed',
    width: 140,
    sortable: true,
    filter: 'date',
    cell: (o) => day.format(new Date(o.placed)),
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (o) => money.format(o.total),
  },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, sortable: true, filter: 'set' },
];
```

## Cells

- With the element: a string, a number, a DOM node or a Lit `html` template.
- React: JSX (`ReactColumnDef`). Vue: a `#cell-<id>` slot, or VNodes from `h()` (`VueColumnDef`). Angular: `<ng-template argusCell="<id>">`. See the framework guides.
- Cell content lives in the page's light DOM: the page's CSS and components work in it. Style it with your own classes.
- Cells are pooled: a cell's component gets the next row's props as the table scrolls. Don't keep per-row state in it.
- Interactive content (buttons, links, inputs) in cells works: clicks on it don't select the row or start a drag.

## Column groups

```ts
const columnGroups: ColumnGroup[] = [
  { id: 'customer', header: 'Customer', columns: ['name', 'email'] },
  { id: 'money', header: 'Amounts', columns: ['net', 'tax', 'total'] },
];
```

Columns stay flat in `columns`; groups only add header rows. Columns not in a group get an empty cell above them.

## Totals and summary rows

`pinnedRows: { bottom: [totalsRow] }` keeps a row at the bottom, outside sorting and filtering. It's an object of the row type: compute it from `data` (and recompute when `data` changes). Give the columns' `cell` a way to render it (`ctx.pinned === 'bottom'`).
