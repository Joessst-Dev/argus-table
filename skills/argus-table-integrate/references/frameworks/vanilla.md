# The element: `argus-table`

For plain HTML and JavaScript, and for frameworks without a wrapper (Svelte, Solid, Lit, Astro, Alpine, htmx). Install `argus-table` and `@argus-table/themes`; or use the CDN without a bundler.

## Full example

```html file=index.html
<!doctype html>
<html lang="en">
  <body>
    <input id="search" type="search" aria-label="Search orders" />
    <argus-table
      id="orders"
      aria-label="Orders"
      selection-mode="multi"
      selection-checkboxes
    ></argus-table>
    <p id="status" role="status"></p>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

```js file=main.js
import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import '@argus-table/themes/default.css';

const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

function badge(order) {
  const span = document.createElement('span');
  span.className = `badge badge-${order.status}`;
  span.textContent = order.status;
  return span;
}

const table = document.querySelector('#orders');

// Objects and functions are properties, never attributes.
table.columns = [
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
    cell: (o) => money.format(o.total),
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    sortable: true,
    filter: 'set',
    cell: badge,
  },
];
table.getRowId = (order) => order.id;
table.plugins = [headerMenu()];
table.data = await (await fetch('/api/orders')).json();

document.querySelector('#search').addEventListener('input', (e) => {
  table.quickFilter = e.target.value;
});
table.addEventListener('argus-selection-change', (e) => {
  document.querySelector('#status').textContent = `${String(e.detail.selection.length)} selected`;
});
table.addEventListener('argus-row-click', (e) => console.log(e.detail.row));
```

## Rules

- **Properties for objects and functions:** `table.columns = …`, `table.data = …`, `table.getRowId = …`, `table.plugins = …`, `table.dataSource = …`, `table.sorting = …`. Attributes only for simple values: `density`, `row-height`, `overscan`, `virtualize-columns`, `quick-filter`, `selection-mode`, `selection-checkboxes`.
- **Events:** `addEventListener('argus-…', …)`, with the data in `e.detail` ([api.md](../api.md#events)).
- **State you set is controlled:** after `table.sorting = […]`, clicks only fire `argus-sorting-change`; set `table.sorting = e.detail.sorting` in the listener, or use `table.setState({ sorting })` for a starting value instead.
- **New rows:** assign a new array (`table.data = [...rows, row]`), or call `table.refresh()` after changing rows in place.
- **Cells:** strings, numbers, DOM nodes or Lit `html` templates.
- **TypeScript:** `const table = document.querySelector<ArgusTable<Order>>('argus-table')!` with `import type { ArgusTable, ColumnDef } from 'argus-table'`; the element is typed in `HTMLElementTagNameMap` and the events in `HTMLElementEventMap`.

## Without a bundler

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/argus-table@1/dist/cdn/argus-table.js"
></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes@1/dist/default.css" />
<script type="module">
  import { headerMenu } from 'https://cdn.jsdelivr.net/npm/@argus-table/header-menu@1/+esm';
  const table = document.querySelector('argus-table');
  table.plugins = [headerMenu()];
</script>
```

The CDN bundle has everything inlined. Never load it and an npm import of `argus-table` on the same page.

## Svelte

Svelte sets props on custom elements as properties when the element has them: `<argus-table aria-label="Orders" columns={columns} data={rows} bind:this={table} />`. Listen to events with `table.addEventListener('argus-row-click', …)` in `onMount` (Svelte 4 also takes `on:argus-row-click={open}`). With SvelteKit, import `'argus-table'` in the browser only (`onMount(() => import('argus-table'))`, or `export const ssr = false` for the page). Keep `columns` in a module-level variable (or `$state.raw`), not rebuilt in markup.

## Solid

`<argus-table prop:columns={columns} prop:data={rows()} on:argus-row-click={open} aria-label="Orders" />`: the `prop:` prefix sets properties.

## Lit

`html\`<argus-table aria-label="Orders" .columns=${this.columns} .data=${this.rows} @argus-row-click=${this.open}></argus-table>\``: the `.`prefix sets properties. Define`columns`as a class field, not in`render()`.

## Astro

Render `<argus-table>` in an island that runs in the browser (`client:only`), or a `<script>` that imports `argus-table` and sets the properties.
