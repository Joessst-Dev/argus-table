# Public API draft

[← Back to contents](../README.md)

One element, `<argus-table>`, configured through JS properties; attributes only for simple flags. Part and token names are frozen at 1.0, so this section is the thing to review hardest.

## Basic usage

```html
<argus-table id="orders" density="compact"></argus-table>
<script type="module">
  import 'argus-table';
  const table = document.querySelector('#orders');
  table.columns = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    { id: 'customer', header: 'Customer', accessor: 'customer.name', width: 'auto' },
    { id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true },
    { id: 'actions', header: '', width: 64, pin: 'end', cell: (row) => html`<button>…</button>` },
  ];
  table.data = orders; // or: table.dataSource = { getRows }
</script>
```

## Declarative columns (alternative to `columns`)

Columns can also be written as `<argus-column>` children. They are data-only elements: the table reads them into the same `ColumnDef[]`, so both styles share one code path.

```html
<argus-table>
  <argus-column id="id" header="Order" accessor="id" width="90" pin="start"></argus-column>
  <argus-column id="customer" header="Customer" accessor="customer.name" width="auto"></argus-column>
  <argus-column id="total" header="Total" accessor="total" align="end" sortable></argus-column>
  <argus-column id="actions" width="64" pin="end">
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
| `id` | string | Stable key (state, parts, persistence). Must be unique and non-empty |
| `header` | `CellContent` \| `() => CellContent` | Header content |
| `accessor` | string path (`'customer.name'`) \| `(row, index) => value` | Cell value |
| `cell` | `(row, context) => CellContent` | Custom cell content (rendered into light DOM). `context` is `{ row, rowId, index, columnId, value }` |
| `width` | number \| `'auto'` \| `{ flex }` | Width mode. Default 150 px. `{ flex }` is a share of free space, at least `minWidth`; pinned columns ignore it. `'auto'` arrives in Phase 2 |
| `minWidth` / `maxWidth` | number | Resize bounds. Default 40 px / no limit |
| `pin` | `'start'` \| `'end'` | Fixed column. Logical sides: `'start'` is the left in LTR and the right in RTL. (TanStack v9 uses the same logical names, so no mapping is needed.) |
| `resizable` / `sortable` | boolean | Feature flags per column. Default: resizable, not sortable |
| `align` | `'start'` \| `'center'` \| `'end'` | Text alignment. Default `'start'` |

- `CellContent` is a Lit `TemplateResult`, a DOM `Node`, a string or a number.
- Without `cell`, a cell shows its accessor value as text. Empty values (`null`, `undefined`) sort last in both directions.

## Properties

| Property | Attribute | Type | Default |
| --- | --- | --- | --- |
| `columns` | — | `ColumnDef[]` | `[]` |
| `data` | — | `T[]` | `[]` |
| `dataSource` | — | `{ getRows(req) }` | — |
| `pinnedRows` | — | `{ top?: T[], bottom?: T[] }` | — |
| `rowHeight` | `row-height` | number \| `'auto'` | unset: the density (or the `--argus-row-height` token) decides (40px at `comfortable`). A number set explicitly wins over density; `'auto'` (Phase 2) measures rows |
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

## Slots

- `empty`: shown instead of the body when there are no rows. Default text: "No rows".
- Cell and header content uses private, generated slot names ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)); don't target them.

## Parts

`table`, `header`, `header-row`, `header-cell`, `header-cell-sorted`, `resize-handle`, `body`, `row`, `row-pinned`, `row-even`, `row-odd`, `row-selected`, `cell`, `cell-pinned`, `cell-pinned-edge`, `cell-sorted`, `footer`, `skeleton`, `empty`.

- `header-cell-sorted` is added next to `header-cell` on the sorted column's header. `cell-sorted` is for body cells in that column. They are separate so that `::part(cell-sorted)` never matches headers. The direction is exposed through `aria-sort` only; attribute selectors can't follow `::part()`, so styling per direction is left out until a theme needs it.
- `cell-pinned` is on every pinned cell on either side, and `cell-pinned-edge` is added on the pinned cell next to the scrolling columns. There are no per-side parts; the component mirrors the edge shadow itself.

## Tokens (first set)

`--argus-bg`, `--argus-fg`, `--argus-header-bg`, `--argus-header-fg`, `--argus-border-color`, `--argus-border-width`, `--argus-row-hover-bg`, `--argus-row-stripe-bg`, `--argus-row-selected-bg`, `--argus-cell-padding-inline`, `--argus-row-height`, `--argus-font`, `--argus-pinned-shadow`, `--argus-resize-handle-color`, `--argus-focus-ring`.

- `--argus-row-height` and `--argus-cell-padding-inline` each have a default per density: 32 / 40 / 52 px rows and 8 / 12 / 16 px padding for compact / comfortable / spacious; see [Styling and theming](06-styling-and-theming.md).
- The element is 400 px tall by default, because a virtualized table needs a bounded height; set `height` (or `block-size`) on it.
- `--argus-pinned-shadow` takes a `box-shadow` value written for a shadow falling toward the end side, for example `4px 0 6px -4px rgb(0 0 0 / .2)`. The component mirrors it for the end edge and in RTL. `none` removes it.
