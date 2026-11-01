# Public API draft

[← Back to contents](../README.md)

One element, `<argus-table>`, configured through JS properties; attributes only for simple flags. Part and token names are frozen at 1.0, so this section is the thing to review hardest.

## Basic usage

```html
<argus-table id="orders" row-height="40" density="compact"></argus-table>
<script type="module">
  import 'argus-table';
  const table = document.querySelector('#orders');
  table.columns = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'left' },
    { id: 'customer', header: 'Customer', accessor: 'customer.name', width: 'auto' },
    { id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true },
    { id: 'actions', header: '', width: 64, pin: 'right', cell: (row) => html`<button>…</button>` },
  ];
  table.data = orders; // or: table.dataSource = { getRows }
</script>
```

## Declarative columns (alternative to `columns`)

Columns can also be written as `<argus-column>` children. They are data-only elements: the table reads them into the same `ColumnDef[]`, so both styles share one code path.

```html
<argus-table>
  <argus-column id="id" header="Order" accessor="id" width="90" pin="left"></argus-column>
  <argus-column id="customer" header="Customer" accessor="customer.name" width="auto"></argus-column>
  <argus-column id="total" header="Total" accessor="total" align="end" sortable></argus-column>
  <argus-column id="actions" width="64" pin="right">
    <template><button>…</button></template>
  </argus-column>
</argus-table>
```

- A `MutationObserver` plus attribute changes on `argus-column` rebuild the column list, so `v-for`, `@for` or `.map()` in a framework just work.
- Functions can't be attributes: `accessorFn` and `cell` are set as properties on the `argus-column` element; a child `<template>` covers simple static cells.
- Rule: if the `columns` property is set, it wins and children are ignored (with a dev-mode warning).
- Generated cell content goes into one dedicated light-DOM container, so it never mixes with `argus-column` children.
- Effort: roughly a few days on top of the property API, planned for Phase 2.

## Column definition

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Stable key (state, parts, persistence) |
| `header` | string \| template fn | Header content |
| `accessor` | string path \| fn | Cell value |
| `cell` | template fn | Custom cell renderer (rendered into light DOM) |
| `width` | number \| `'auto'` \| `{ flex }` | Width mode |
| `minWidth` / `maxWidth` | number | Resize bounds |
| `pin` | `'left'` \| `'right'` | Fixed column |
| `resizable` / `sortable` | boolean | Feature flags per column |
| `align` | `'start'` \| `'center'` \| `'end'` | Text alignment |

## Properties

| Property | Attribute | Type | Default |
| --- | --- | --- | --- |
| `columns` | — | `ColumnDef[]` | `[]` |
| `data` | — | `T[]` | `[]` |
| `dataSource` | — | `{ getRows(req) }` | — |
| `pinnedRows` | — | `{ top?: T[], bottom?: T[] }` | — |
| `rowHeight` | `row-height` | number \| `'auto'` | 40 |
| `density` | `density` | `'compact'` \| `'comfortable'` \| `'spacious'` | `'comfortable'` |
| `sorting` | — | `SortState` (controlled or uncontrolled) | — |
| `columnSizing` | — | `Record<id, px>` | — |
| `getRowId` | — | `(row) => string` | index |
| `overscan` | `overscan` | number | 6 |

## Events

All `CustomEvent`, bubbling and composed. See [State and events](../code-architecture/04-state-and-events.md) for the controlled/uncontrolled rules.

| Event | Detail |
| --- | --- |
| `argus-sort-change` | `{ sorting }` |
| `argus-column-resize` | `{ columnId, width, sizing }` |
| `argus-row-click` | `{ row, rowId, index }` |
| `argus-cell-click` | `{ row, columnId, value }` |
| `argus-range-change` | `{ start, end }` visible rows |
| `argus-load-error` | `{ error, start, end }` |

## Methods

`scrollToRow(index)`, `scrollToColumn(id)`, `refresh()`, `autosizeColumns(ids?)`, `getState()` / `setState()`.

## Parts

`table`, `header`, `header-row`, `header-cell`, `resize-handle`, `body`, `row`, `row-pinned`, `row-even`, `row-odd`, `row-selected`, `cell`, `cell-pinned`, `cell-pinned-edge`, `cell-sorted`, `footer`, `skeleton`, `empty`.

## Tokens (first set)

`--argus-bg`, `--argus-fg`, `--argus-header-bg`, `--argus-header-fg`, `--argus-border-color`, `--argus-border-width`, `--argus-row-hover-bg`, `--argus-row-stripe-bg`, `--argus-row-selected-bg`, `--argus-cell-padding-inline`, `--argus-row-height`, `--argus-font`, `--argus-pinned-shadow`, `--argus-resize-handle-color`, `--argus-focus-ring`.
