# argus-table

`<argus-table>` is a data table web component built with Lit and TanStack. It works in any framework, or none.

- **Virtualized rows:** 100,000 rows scroll smoothly, and the DOM stays the same size.
- **Pinned columns** at the start or end, which mirror in right-to-left layouts.
- **Sorting and resizing:** by mouse or keyboard, controlled or uncontrolled.
- **Accessible:** the WAI-ARIA grid pattern, with one tab stop and arrow-key navigation.
- **Plain CSS styling:** `--argus-*` tokens and `::part()` names. Cell content is light DOM, so your own CSS and components work inside cells.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i argus-table @argus-table/themes
```

## A first table

```html
<argus-table id="orders" aria-label="Orders" style="height: 400px"></argus-table>

<script type="module">
  import 'argus-table';
  import '@argus-table/themes/default.css';

  const table = document.querySelector('#orders');
  table.columns = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer.name',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  table.data = await (await fetch('/api/orders')).json();
  table.getRowId = (order) => order.id;
  table.addEventListener('argus-row-click', (e) => console.log(e.detail.row));
</script>
```

- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.
- **Label:** give it a name with `aria-label` or `aria-labelledby`.
- **Columns and data** are JavaScript properties, because they hold objects and functions.
- **Cells:** a column's `cell` function can return a string, a number, a DOM node or a Lit template.

## Without a bundler

The CDN build has every dependency bundled:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js"
></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes/dist/default.css" />
```

## Status

This is v0.1, an early release. Names can still change before 1.0. Infinite loading, pinned rows, auto column widths, column reordering and framework wrappers come in v0.2. See the [roadmap](https://github.com/Joessst-Dev/argus-table/blob/main/docs/plan/plan/12-roadmap.md).

MIT licensed.
