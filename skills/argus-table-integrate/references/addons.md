# Add-ons

Add-ons are plugins: create each once and pass them in `plugins`, in this order:

```ts
const plugins = [tableExport(), formulas(), headerMenu()]; // the ones you use, in this order
```

Each is its own package, released with the table at the same version. `@argus-table/header-menu` and `@argus-table/formulas` have `lit` as a peer dependency (npm, pnpm and bun install it; with Yarn, add `lit@^3.3.0`). Define `plugins` once (module scope, `useMemo`, a class field): new instances reconnect and close open menus. One instance can serve several tables.

## Column menu: `@argus-table/header-menu`

```ts
import { headerMenu } from '@argus-table/header-menu';
const plugins = [headerMenu<Order>()];
```

A button in each header opens a menu: sort ascending / descending / clear, Filter… (for columns with a `filter` kind), pin to start / end, fit width, hide, and "Hidden columns" to show them again. Items follow the columns' `sortable`, `filter`, `pinnable`, `hideable` and `resizable`.

- `headerMenu({ sort, fitWidth, pin, hide, filter, labels })`: each `false` turns that item off (all default to `true`; `sort` and `fitWidth` since 1.1).
- Pinning, hiding and filtering go through `columnPinning`, `columnVisibility` and `columnFilters`: controlled or not, as you bind them.
- Keyboard: Alt+ArrowDown or the context-menu key on a header.
- This is the argus-table way to give users column filters, hiding and pinning. There's no filter row under the header.

## Export: `@argus-table/export`

```ts
import { downloadTable, exportTable, tableExport } from '@argus-table/export';

const plugins = [tableExport({ filename: 'orders' })];

// later, from a button:
await downloadTable(tableElement, 'xlsx'); // 'csv' | 'xlsx' | 'pdf'
const blob = await exportTable(tableElement, 'csv'); // to upload instead
```

- `downloadTable()` and `exportTable()` reject unless `tableExport()` is in that table's `plugins`.
- Exports what the table shows: shown columns in order, the rows the filters keep in the current sort, pinned rows, group header rows. Values come from each column's `accessor`, not its `cell`.
- Options (on `tableExport()` or per call): `rows: 'selected'`, `hiddenColumns`, `allRows` (with a `dataSource`, fetches every row through `getRows`), `columns: { [id]: { header, value, exclude } }`, `formats`, `menu` (an Export group in the column menu; `false` to leave it out).
- `tableElement` is the element: a React `ref`'s `current`, a Vue template ref's `.element`, Angular `viewChild(ArgusTableComponent)` then `.element`, or `document.querySelector('argus-table')`.
- Since 1.1.

## Formula columns: `@argus-table/formulas`

```ts
import { formulas } from '@argus-table/formulas';

const plugins = [formulas(), headerMenu()];
const columns = [
  { id: 'price', header: 'Price', accessor: 'price' },
  { id: 'qty', header: 'Qty', accessor: 'qty' },
  { id: 'total', header: 'Total', formula: '[price] * [qty]', sortable: true },
];
```

- Spreadsheet-style formulas over other columns (`[price]`, `SUM([[qty]])` for a whole column, `IF`, `ROUND`, …).
- `formulas({ editing: 'edit' | 'view' | 'none' })`: with the column menu, users can add and edit formula columns. The editor never changes `columns` itself: it fires `argus-formula-column-add`, `-change` and `-remove` with `detail.columns`, and the app sets `columns` to it (React `onFormulaColumnAdd`, Vue `@formula-column-add`, Angular `(formulaColumnAdd)`). With `editing: 'none'` there's nothing to handle.
- With a `dataSource`, formula columns don't sort or filter.

## Translations

The table, the menu and the export have their own text: `labels` on the table (`TableLabels`), `headerMenu({ labels })`, `formulas({ labels })`, `tableExport({ labels })`. Pass only the keys you translate. Text with values is a function: `{ rowCount: ({ count }) => `${String(count)} Zeilen` }`.
