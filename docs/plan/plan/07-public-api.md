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
| `cell` | `(row, context) => CellContent` | Custom cell content (rendered into light DOM). `context` is `{ row, rowId, index, columnId, value, pinned? }`; `pinned` is `'top'` or `'bottom'` for a row from `pinnedRows` |
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
| `dataSource` | — | `{ getRows(request), pageSize? }` | — (wins over `data` while set; see [Data source](#data-source)) |
| `pinnedRows` | — | `{ top?: T[], bottom?: T[] }` | — (see [Pinned rows](#pinned-rows)) |
| `rowHeight` | `row-height` | number \| `'auto'` | unset: the density (or the `--argus-row-height` token) decides (40px at `comfortable`). A number set explicitly wins over density; `'auto'` (Phase 2) measures rows |
| `density` | `density` | `'compact'` \| `'comfortable'` \| `'spacious'` | `'comfortable'` |
| `sorting` | — | `SortState` (controlled or uncontrolled) | — |
| `columnSizing` | — | `Record<id, px>` | — |
| `getRowId` | — | `(row, index) => string` | index (among all rows, for a `dataSource`) |
| `overscan` | `overscan` | number | 6 |

## Data source

`dataSource` loads rows page by page as they scroll into view, instead of `data`. The table owns the cache; the host only answers requests.

```ts
table.dataSource = {
  pageSize: 100, // default
  async getRows({ start, end, sorting, signal }) {
    const res = await fetch(`/api/orders?offset=${start}&limit=${end - start}&sort=${encode(sorting)}`, { signal });
    const { rows, total } = await res.json();
    return { rows, total }; // total is optional
  },
};
```

- `start` is inclusive and `end` exclusive, like `Array.prototype.slice`, so `end - start` is the limit. (`argus-range-change` reports inclusive indices; the two answer different questions.)
- Only pages in view (plus `overscan`) are requested, once the range has been quiet for 50 ms, so fast scrolling loads where it stops. Pages that scroll more than a page away are aborted through `signal`; answers for an old source, order or `refresh()` are dropped. Pages far from the view (more than 10 pages away) are evicted, so memory stays bounded.
- With `total`, the table has exactly that many rows. Without it, the table keeps one page of skeleton rows below the last row it has, and a page with fewer rows than asked for marks the end. `aria-rowcount` is `-1` while the total is unknown.
- Sorting happens on the server: `sorting` arrives in every request, and a new order clears the cache, aborts what's in flight and scrolls to the top. The `sorting` property keeps its controlled and uncontrolled rules. A `filter` field joins the request once the table has filtering.
- Rows not loaded yet render as skeletons: part `row-loading` on the row (with `aria-busy="true"`), part `skeleton` on a bar in each cell, coloured by `--argus-skeleton-bg`. The bars pulse unless `prefers-reduced-motion` is set.
- A page that fails (rejects or throws) fires `argus-load-error` and shows its rows with `skeleton skeleton-error` bars. Its first visible row gets a Retry button (part `retry`, labelled "Retry loading rows 201 to 300"); Enter on any cell of a failed row retries too. A failed page isn't requested again on its own until it scrolls far away and back.
- Clicks and Enter on rows that haven't loaded fire no `argus-cell-click` or `argus-row-click`. Focus can rest on a skeleton cell and stays there when the row arrives.
- `refresh()` drops every page and loads the rows in view again, keeping the scroll position. Replace the `dataSource` object to change `getRows` or `pageSize`.

## Pinned rows

`pinnedRows` fixes rows below the header (`top`) and at the bottom of the view (`bottom`), for example a totals row. They are separate objects, not rows of `data`:

```ts
table.pinnedRows = { bottom: [{ id: 'total', customer: 'Total', total: sum }] };
```

- Columns read them like any row (accessor, `cell`), and `cell` gets `pinned: 'top' | 'bottom'` in its context, so a column can render a totals row its own way. `index` there is the row's index in its list. Without `getRowId`, their ids are `'top-0'`, `'bottom-0'` and so on; with it, `getRowId(row, index)`.
- They are never sorted, aren't counted as data rows, aren't virtualized or pooled, and work the same with `data` and `dataSource` (they don't wait for pages).
- They stay in place while the body scrolls: the bottom rows sit at the bottom of the view, or right after the last row when the body is shorter. With no data rows, the `empty` slot shows between them.
- Rows are numbered header, top, body, bottom: `aria-rowindex` of the first body row is 2 plus the number of top rows, and `aria-rowcount` counts them all (still `-1` while a `dataSource` total is unknown).
- They take part in keyboard navigation (see [Accessibility](08-accessibility.md)), and clicks and Enter fire `argus-cell-click` and `argus-row-click` with `pinned` in the detail.
- Parts: `row row-pinned row-pinned-top` (or `-bottom`) on the row, `cell cell-pinned-row` on its cells. `--argus-pinned-row-bg` sets their background, pinned columns included.
- Replace the object to update them.

## Events

All `CustomEvent`, bubbling and composed. See [State and events](../code-architecture/04-state-and-events.md) for the controlled/uncontrolled rules.

| Event | Detail |
| --- | --- |
| `argus-sort-change` | `{ sorting }` |
| `argus-column-resize` | `{ columnId, width, sizing }` |
| `argus-row-click` | `{ row, rowId, index, pinned? }` |
| `argus-cell-click` | `{ row, columnId, value, pinned? }` |
| `argus-range-change` | `{ start, end }` visible rows |
| `argus-load-error` | `{ error, start, end }`: a `dataSource` page failed; `end` exclusive |

- The package exports each name as a constant (`SORT_CHANGE`, `COLUMN_RESIZE`, `CELL_CLICK`, `ROW_CLICK`, `RANGE_CHANGE`, …), and `HTMLElementEventMap` types each `detail`.
- `argus-sort-change` fires on a click on a sortable header, or Enter or Space on a focused one; the order cycles ascending → descending → unsorted. When `sorting` is uncontrolled, it fires after the rows are re-sorted. When controlled, it carries the proposed order and nothing changes until the host sets `sorting`. v0.1 sorts by one column at a time.
- `argus-column-resize` fires when a column is resized by dragging its `resize-handle` or with Alt+Arrow on its focused header (10 px; the arrow toward the inline end grows it). The handle is a `separator` labelled "Resize column" (English until the table gets an i18n option). During a drag it fires once per animation frame, so a controlled host can follow the drag; `width` is already clamped to `minWidth`/`maxWidth`.
- `argus-cell-click` and `argus-row-click` fire on a click in the body, in that order, including clicks on content inside a cell (check `event.composedPath()` to skip your own buttons). `row` is the data object, `value` what the column's accessor reads. On a pinned row, `pinned` is `'top'` or `'bottom'` and `index` is the row's index in its list. Enter on a focused body cell fires both too (Enter pressed in content inside a cell is left to that content). Header clicks fire neither.

## Methods

`scrollToRow(index)`, `scrollToColumn(id)`, `refresh()`, `autosizeColumns(ids?)`, `getState()` / `setState()`.

- `refresh()` (v0.2): with a `dataSource`, drops every loaded page and loads the rows in view again; with `data`, re-renders the cells. Resolves once the table has re-rendered.

## Slots

- `empty`: shown instead of the body when there are no rows. Default text: "No rows".
- Cell and header content uses private, generated slot names ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)); don't target them.

## Parts

`table`, `header`, `header-row`, `header-cell`, `header-cell-sorted`, `resize-handle`, `body`, `row`, `row-pinned`, `row-pinned-top`, `row-pinned-bottom`, `row-even`, `row-odd`, `row-selected`, `row-loading`, `cell`, `cell-pinned`, `cell-pinned-edge`, `cell-pinned-row`, `cell-sorted`, `footer`, `skeleton`, `skeleton-error`, `retry`, `empty`.

- `row-pinned` is on every row from `pinnedRows`, with `row-pinned-top` or `row-pinned-bottom` for its side (`::part()` can't tell them apart by attribute). Pinned rows also have `row`, but not `row-even`/`row-odd`. Their cells add `cell-pinned-row` to `cell`; don't confuse it with `cell-pinned`, which marks cells in pinned *columns*.

- `row-loading`, `skeleton`, `skeleton-error` and `retry` belong to `dataSource` loading; see [Data source](#data-source).

- `header-cell-sorted` is added next to `header-cell` on the sorted column's header. `cell-sorted` is for body cells in that column. They are separate so that `::part(cell-sorted)` never matches headers. The direction is exposed through `aria-sort` only; attribute selectors can't follow `::part()`, so styling per direction is left out until a theme needs it.
- `cell-pinned` is on every pinned cell on either side, and `cell-pinned-edge` is added on the pinned cell next to the scrolling columns. There are no per-side parts; the component mirrors the edge shadow itself.

## Tokens (first set)

`--argus-bg`, `--argus-fg`, `--argus-header-bg`, `--argus-header-fg`, `--argus-border-color`, `--argus-border-width`, `--argus-row-hover-bg`, `--argus-row-stripe-bg`, `--argus-row-selected-bg`, `--argus-cell-padding-inline`, `--argus-row-height`, `--argus-font`, `--argus-pinned-shadow`, `--argus-resize-handle-color`, `--argus-focus-ring`, `--argus-skeleton-bg`, `--argus-pinned-row-bg`.

- `--argus-skeleton-bg` colours the skeleton bars of rows still loading. Default: the text colour at 12% opacity.
- `--argus-pinned-row-bg` is the background of the rows from `pinnedRows`, pinned columns included (a background set through `::part(row-pinned)` wouldn't reach the cells in pinned columns, which paint their own). Default: `--argus-bg`.

- `--argus-row-height` and `--argus-cell-padding-inline` each have a default per density: 32 / 40 / 52 px rows and 8 / 12 / 16 px padding for compact / comfortable / spacious; see [Styling and theming](06-styling-and-theming.md).
- The element is 400 px tall by default, because a virtualized table needs a bounded height; set `height` (or `block-size`) on it.
- `--argus-row-selected-bg` is reserved for row selection (after v0.1). The table doesn't read it yet; themes may set it already.
- `--argus-focus-ring` is an `outline` value for the focused cell or header (`:focus-visible`). Default: `2px solid Highlight`.
- `--argus-pinned-shadow` takes a `box-shadow` value written for a shadow falling toward the end side, for example `4px 0 6px -4px rgb(0 0 0 / .2)`. The component mirrors it for the end edge and in RTL. `none` removes it.
