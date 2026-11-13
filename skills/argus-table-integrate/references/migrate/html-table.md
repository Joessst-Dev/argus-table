# From a plain `<table>`

Covers hand-written tables filled from data: a `<table>` with `v-for`, `*ngFor` / `@for`, `{#each}`, `.map()` in JSX, or rows built in a script (`insertRow`, `innerHTML`). Static tables (a few fixed rows of text) are usually better left as they are.

## Detect

`<table>` whose rows come from a loop or a script. `scan.mjs` reports only those, unless `--include-static-tables`.

## Concepts

| Feature id     | Plain table                                      | argus-table                                         | Fit     | Notes                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------ | --------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sorting`      | click handlers on `<th>` that sort the array     | `sortable: true`                                    | maps    | Delete the sort code and its state                                                                                                                                                                                                                                    |
| `search`       | an input that filters the array                  | `quickFilter`                                       | partial | Keep the input; bind its value to `quickFilter`. It keeps rows where every word appears in some shown column (values included as text), so a search that looked at one or two fields gets broader. If that matters, keep the old filter and pass its result as `data` |
| `selection`    | checkboxes in a column, a selected set           | `selectionMode`, `selectionCheckboxes`, `selection` | maps    |                                                                                                                                                                                                                                                                       |
| `sticky`       | `position: sticky` on `<th>` or the first column | built in (header), `pin: 'start'` (columns)         | builtin |                                                                                                                                                                                                                                                                       |
| `pagination`   | `slice()` per page, page buttons                 | none: the table scrolls                             | gap     | [gaps.md](../gaps.md#pagination)                                                                                                                                                                                                                                      |
| `tfoot`        | `<tfoot>` with totals                            | `pinnedRows.bottom`                                 | partial | A totals row object                                                                                                                                                                                                                                                   |
| `header-spans` | `colspan` in `<thead>`                           | `columnGroups`                                      | maps    |                                                                                                                                                                                                                                                                       |
| `body-spans`   | `colspan` / `rowspan` in `<tbody>`               | none                                                | gap     | [gaps.md](../gaps.md#cell-spanning)                                                                                                                                                                                                                                   |
| `editing`      | inputs or `contenteditable` in cells             | inputs in `cell` content                            | gap     | [gaps.md](../gaps.md#editing)                                                                                                                                                                                                                                         |
| `row-click`    | click handlers on `<tr>`                         | `argus-row-click` / `onRowClick` / `@row-click`     | maps    | Also fires on Enter                                                                                                                                                                                                                                                   |

## Columns

Each `<th>` and its `<td>` become one column: the `<th>` text is `header`, what the `<td>` shows is `accessor` (the raw value) and `cell` (the formatted content):

```html
<!-- Before -->
<th>Total</th>
…
<td class="num">{{ formatMoney(order.total) }}</td>
```

```ts
// After
{ id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true, cell: (o) => formatMoney(o.total) }
```

## State and events

- The array the loop iterated over becomes `data`. Replace it to change rows.
- Sort state (`sortKey`, `sortDir`) and sort functions → `sortable: true` per column (and `sorting` if the app must know the order).
- Search state → `quickFilter`.
- Page state → delete it (or keep a paginator outside, [gaps.md](../gaps.md#pagination)).

## Example

```js
// Before: main.js
for (const order of orders.slice(page * 50, page * 50 + 50)) {
  const tr = tbody.insertRow();
  tr.insertCell().textContent = order.customer;
  tr.insertCell().textContent = money(order.total);
}

// After
import 'argus-table';
import '@argus-table/themes/default.css';
const table = document.querySelector('argus-table'); // <argus-table aria-label="Orders"></argus-table>
table.columns = [
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    align: 'end',
    sortable: true,
    cell: (o) => money(o.total),
  },
];
table.getRowId = (o) => String(o.id);
table.data = orders;
```

## Gaps

Pagination, body cell spans, inline editing. See [gaps.md](../gaps.md).

## Remove

The table markup, the row-building code, sort and pagination code, and table CSS that only styled it (the theme takes over; cell content keeps its classes).

## Behaviour differences

- The rows are virtualized: only rows in view are in the DOM, so page search (Ctrl+F) finds only those, and tests must query the grid ([testing.md](../testing.md)).
- It's a keyboard grid: one tab stop, arrow keys between cells.
- A header click cycles ascending → descending → unsorted; hand-written sorts often only toggled.
- The table uses the theme's font: add `argus-table { --argus-font: inherit; }` to keep the page's.
- What the cells showed (formatting, conditional classes such as a low-stock highlight) goes into `cell`, or a slot or template in the wrappers.
- The table has its own height (400px by default) and scrolls inside it.
