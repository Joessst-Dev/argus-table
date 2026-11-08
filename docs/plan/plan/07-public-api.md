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
  <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start"></argus-column>
  <argus-column column-id="customer" header="Customer" accessor="customer.name" width="auto"></argus-column>
  <argus-column column-id="total" header="Total" accessor="total" align="end" sortable></argus-column>
  <argus-column column-id="actions" width="64" pin="end" resizable="false">
    <template><button>…</button></template>
  </argus-column>
</argus-table>
```

| Attribute | Property | Notes |
| --- | --- | --- |
| `column-id` | `columnId` | The column's `id`. Not the global `id` attribute: two tables with the same column would otherwise put duplicate ids in the page |
| `header` | `header` | Text as an attribute; a template, a node or a function as a property |
| `accessor` | `accessor` | A path as an attribute; a path or a function as a property |
| — | `cell` | Property only. Wins over a `<template>` child |
| `width` | `width` | `90` or `90px`, `auto`, or `2fr` for `{ flex: 2 }`. Anything else means the default |
| `min-width`, `max-width`, `pin`, `align` | same, camelCased | |
| `sortable`, `resizable`, `reorderable` | same | Absent: the default. `"false"`: off. Any other value: on. So `resizable="false"` turns resizing off |

- Adding, removing or moving an `argus-column`, or changing one of its attributes or properties, rebuilds the column list, so `v-for`, `@for` or `.map()` in a framework just work. Sizes, order and sorting are kept by id, as with a new `columns` array. The columns tell the table themselves; the table has no `MutationObserver` on its children, which would fire on every cell render while scrolling.
- Only direct children count, in document order.
- A child `<template>` is static content for every cell of the column (cloned once per rendered cell and kept while the cell is recycled). Content that depends on the row needs the `cell` property. Changes inside the template's content aren't picked up: replace the template.
- Rule: a non-empty `columns` property wins, and the children are ignored (with a one-time console warning). `columns` is `[]` by default, so a framework wrapper that always binds it doesn't hide the children.
- The generated cell content is rendered as direct children of the table (slots need direct children; see ADR 0001), into a Lit part that ends at a private comment marker. Children added later go after the marker, so they never mix with the generated content.

## Column definition

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Stable key (state, parts, persistence). Must be unique and non-empty |
| `header` | `CellContent` \| `() => CellContent` | Header content |
| `accessor` | string path (`'customer.name'`) \| `(row, index) => value` | Cell value |
| `cell` | `(row, context) => CellContent` | Custom cell content (rendered into light DOM). `context` is `{ row, rowId, index, columnId, value, pinned? }`; `pinned` is `'top'` or `'bottom'` for a row from `pinnedRows` |
| `width` | number \| `'auto'` \| `{ flex }` | Width mode. Default 150 px. `{ flex }` is a share of free space, at least `minWidth`; pinned columns ignore it. `'auto'` fits the content (see [Column widths](#column-widths)) |
| `minWidth` / `maxWidth` | number | Resize bounds. Default 40 px / no limit |
| `pin` | `'start'` \| `'end'` | Fixed column. Logical sides: `'start'` is the left in LTR and the right in RTL. (TanStack v9 uses the same logical names, so no mapping is needed.) |
| `resizable` / `sortable` | boolean | Feature flags per column. Default: resizable, not sortable |
| `reorderable` | boolean | Whether the column can be moved (see [Column order](#column-order)). Default: `true` |
| `align` | `'start'` \| `'center'` \| `'end'` | Text alignment. Default `'start'` |

- `CellContent` is a Lit `TemplateResult`, a DOM `Node`, a string or a number.
- Without `cell`, a cell shows its accessor value as text. Empty values (`null`, `undefined`) sort last in both directions.

## Column widths

- `width: 'auto'` fits the column to its header, its pinned rows and the body rows rendered at that moment (visible plus `overscan`), within `minWidth` and `maxWidth`. Rows out of view aren't measured. Pinned columns can be `'auto'` too.
- It measures once the first loaded rows render, and then keeps that width: scrolling, new `data` or a new `columns` array with the same ids don't change it. With no rows it fits the header (and pinned rows), and fits again when rows arrive. While a `dataSource` loads its first page, it keeps the default width.
- The measured width isn't state: it doesn't appear in `columnSizing` and fires no event. A resize wins over it, as it does over `{ flex }`.
- A double-click on a column's `resize-handle` fits it to the rows in view; `autosizeColumns(ids?)` does the same for several. Both are resizes: they write `columnSizing` (or propose it, when controlled) and fire `argus-column-resize`.
- Columns are measured with the browser's own layout (`max-content`), so templates, components, padding, density and the sort indicator are all counted. Web fonts still loading are measured again once they are ready.

## Column order

- A drag on a header moves its column: a `drop-indicator` line marks the header edge it would land at, the dragged header gets `header-cell-dragging`, and the order changes once, on drop. Escape cancels. The drag starts after a few pixels of movement, so a click still sorts; the click that ends a drag doesn't. Presses on interactive header content (a button, an input) and touches don't drag (a touch scrolls the table).
- Alt+Shift+Arrow on a focused header moves it one place, toward the arrow's side (mirrored in RTL). Focus stays on it, and a polite live region announces "Customer moved to column 3 of 8" (English until the table gets an i18n option). The region sits in the document body: a grid may only own rows.
- Columns move within their own group: start-pinned among start-pinned, scrolling among scrolling, end-pinned among end-pinned. A drag never pins or unpins a column. Dragging a scrolling column near the edge of the scrolling area scrolls it.
- `reorderable: false` keeps a column from being picked up or moved by keys. Other columns can still move past it, so its position can change.
- `columnOrder` is the order as column ids, as the table shows them. `[]` (the default) keeps the order of `columns`; after a move it lists every column. A host-set order is read per group: unknown and repeated ids are ignored, and columns it doesn't list follow the listed ones of their group in `columns` order. A new `columns` array keeps the order, matched by id.

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
| `columnOrder` | — | `string[]` (controlled or uncontrolled) | `[]` (see [Column order](#column-order)) |
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
| `argus-column-reorder` | `{ columnId, order }` |
| `argus-load-error` | `{ error, start, end }`: a `dataSource` page failed; `end` exclusive |

- The package exports each name as a constant (`SORT_CHANGE`, `COLUMN_RESIZE`, `CELL_CLICK`, `ROW_CLICK`, `RANGE_CHANGE`, …), and `HTMLElementEventMap` types each `detail`.
- `argus-sort-change` fires on a click on a sortable header, or Enter or Space on a focused one; the order cycles ascending → descending → unsorted. When `sorting` is uncontrolled, it fires after the rows are re-sorted. When controlled, it carries the proposed order and nothing changes until the host sets `sorting`. v0.1 sorts by one column at a time.
- `argus-column-resize` fires when a column is resized by dragging its `resize-handle` or with Alt+Arrow on its focused header (10 px; the arrow toward the inline end grows it), and when a double-click on the handle or `autosizeColumns()` fits it to its content (once per column that changes, each with the whole new `sizing`). A press on the handle without moving changes nothing. The handle is a `separator` labelled "Resize column" (English until the table gets an i18n option). During a drag it fires once per animation frame, so a controlled host can follow the drag; `width` is already clamped to `minWidth`/`maxWidth`.
- `argus-column-reorder` fires when a column is moved: on drop after a header drag, or with Alt+Shift+Arrow on its focused header. `order` is the whole new order. When `columnOrder` is uncontrolled, it fires after the columns have moved; when controlled, it carries the proposed order and nothing changes until the host sets `columnOrder`. A drop where the column would stay put, or a cancelled drag, fires nothing.
- `argus-cell-click` and `argus-row-click` fire on a click in the body, in that order, including clicks on content inside a cell (check `event.composedPath()` to skip your own buttons). `row` is the data object, `value` what the column's accessor reads. On a pinned row, `pinned` is `'top'` or `'bottom'` and `index` is the row's index in its list. Enter on a focused body cell fires both too (Enter pressed in content inside a cell is left to that content). Header clicks fire neither.

## Methods

`scrollToRow(index)`, `scrollToColumn(id)`, `refresh()`, `autosizeColumns(ids?)`, `getState()` / `setState()`.

- `autosizeColumns(ids?)` (v0.2): fits the given columns (default: every resizable one) to the header, the pinned rows and the rendered body rows, as a resize; see [Column widths](#column-widths). Columns with `resizable: false` keep their width. Resolves once the table has re-rendered.
- `refresh()` (v0.2): with a `dataSource`, drops every loaded page and loads the rows in view again; with `data`, re-renders the cells. Resolves once the table has re-rendered.

## Framework wrappers

`@argus-table/react`, `@argus-table/vue` and `@argus-table/angular` wrap both elements. They are optional: the elements work in any framework without them. Their bindings are generated from the Custom Elements Manifest, so they follow the element; see [Packages](../repo-and-ci/02-packages.md#generated-wrappers). All three follow the same conventions.

Each `argus-*` event drops its prefix and takes the framework's style:

| Element event | React prop | Vue emit | Angular output |
| --- | --- | --- | --- |
| `argus-sort-change` | `onSortChange` | `sort-change` | `sortChange` |
| `argus-column-resize` | `onColumnResize` | `column-resize` | `columnResize` |
| `argus-column-reorder` | `onColumnReorder` | `column-reorder` | `columnReorder` |
| `argus-cell-click` | `onCellClick` | `cell-click` | `cellClick` |
| `argus-row-click` | `onRowClick` | `row-click` | `rowClick` |
| `argus-range-change` | `onRangeChange` | `range-change` | `rangeChange` |
| `argus-load-error` | `onLoadError` | `load-error` | `loadError` |

- Handlers get the element's whole `CustomEvent`, not just its detail, so `composedPath()` stays at hand. Details that carry a row are typed with the row type (`RowClickDetail<T>`, `CellClickDetail<T>`).
- The row type is generic: inferred from `data` and `columns`, or given (`<ArgusTable<Order>>` in React).
- Two-way binding covers the three controllable properties: `sorting` (from `detail.sorting`), `columnSizing` (`detail.sizing`) and `columnOrder` (`detail.order`). React uses the usual controlled pair (`sorting` with `onSortChange`); Vue gets `v-model:sorting`, `v-model:column-sizing` and `v-model:column-order`; Angular gets `[(sorting)]`, `[(columnSizing)]` and `[(columnOrder)]`. A property left unbound stays uncontrolled.
- Methods are reached through the element: a `ref` in React, typed `ArgusTableElement<T>`. In Vue, a template ref exposes the methods and the `element`; in Angular, a view query gives the component, which has them too.
- Vue: the types follow vue-tsc's shape for a generic `<script setup>` component, so templates check props, events, `v-model` and the template ref against the row type. `h()` can't infer it: `h(ArgusTable<Order>, …)`. The wrapper sets the element's properties itself rather than through Vue's DOM prop patching, which would turn a removed number into `0`. A one-way `:sorting` stays controlled, because Vue props are read-only.
- Angular: standalone components (`ArgusTableComponent`, `ArgusColumnComponent`) on the elements' own tags, so templates need no `CUSTOM_ELEMENTS_SCHEMA`. Inputs are `@Input()` setters that write to the element, and two-way binding is an input with a `…Change` output, so a one-way `[sorting]` stays controlled. Angular passes a static attribute to an input of the same name as a string (`width="90"`); a string for a property that has an attribute goes to the attribute, so the element converts it as in HTML, and the input types accept those strings. `null` (the `async` pipe) means unset.
- Events bubble, so a table nested in another table's cell fires its events on the outer table too. The Angular outputs only re-emit the outer table's own events (`event.target`).
- `<argus-column>` is wrapped too (`ArgusColumn`), so loops over columns work. The wrapper component takes the element's name, so the element classes are re-exported as the types `ArgusTableElement` and `ArgusColumnElement`.
- Cell and header content is still a Lit template, a node, a string or a number. Framework content in cells (JSX, Vue slots, `ng-template`) is planned separately: cells are pooled, so it needs a hook in the element.
- Bindings set `undefined` when a prop is removed, so `columns`, `data` and `overscan` read `null` and `undefined` as their defaults.

## Slots

- `empty`: shown instead of the body when there are no rows. Default text: "No rows".
- Cell and header content uses private, generated slot names ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)); don't target them.

## Parts

`table`, `header`, `header-row`, `header-cell`, `header-cell-sorted`, `header-cell-dragging`, `drop-indicator`, `resize-handle`, `body`, `row`, `row-pinned`, `row-pinned-top`, `row-pinned-bottom`, `row-even`, `row-odd`, `row-selected`, `row-loading`, `cell`, `cell-pinned`, `cell-pinned-edge`, `cell-pinned-row`, `cell-sorted`, `footer`, `skeleton`, `skeleton-error`, `retry`, `empty`.

- `row-pinned` is on every row from `pinnedRows`, with `row-pinned-top` or `row-pinned-bottom` for its side (`::part()` can't tell them apart by attribute). Pinned rows also have `row`, but not `row-even`/`row-odd`. Their cells add `cell-pinned-row` to `cell`; don't confuse it with `cell-pinned`, which marks cells in pinned *columns*.

- `row-loading`, `skeleton`, `skeleton-error` and `retry` belong to `dataSource` loading; see [Data source](#data-source).

- `header-cell-dragging` is added to `header-cell` while that header is dragged; `drop-indicator` is a line inside the header where it would land, on its inline-start or inline-end edge. See [Column order](#column-order).

- `header-cell-sorted` is added next to `header-cell` on the sorted column's header. `cell-sorted` is for body cells in that column. They are separate so that `::part(cell-sorted)` never matches headers. The direction is exposed through `aria-sort` only; attribute selectors can't follow `::part()`, so styling per direction is left out until a theme needs it.
- `cell-pinned` is on every pinned cell on either side, and `cell-pinned-edge` is added on the pinned cell next to the scrolling columns. There are no per-side parts; the component mirrors the edge shadow itself.

## Tokens (first set)

`--argus-bg`, `--argus-fg`, `--argus-header-bg`, `--argus-header-fg`, `--argus-border-color`, `--argus-border-width`, `--argus-row-hover-bg`, `--argus-row-stripe-bg`, `--argus-row-selected-bg`, `--argus-cell-padding-inline`, `--argus-row-height`, `--argus-font`, `--argus-pinned-shadow`, `--argus-resize-handle-color`, `--argus-focus-ring`, `--argus-skeleton-bg`, `--argus-pinned-row-bg`, `--argus-drop-indicator-color`, `--argus-outline`, `--argus-radius`.

- `--argus-skeleton-bg` colours the skeleton bars of rows still loading. Default: the text colour at 12% opacity.
- `--argus-outline` is a `border` shorthand drawn around the whole table, inside its size. `--argus-radius` rounds the table's corners; the element's paint containment clips the header, rows and pinned columns to them. Defaults: `none` and `0`. Added in v0.2 for the Material-inspired theme's outlined, rounded surface: a theme can't set `border` or `border-radius` on the host itself.
- `--argus-pinned-row-bg` is the background of the rows from `pinnedRows`, pinned columns included (a background set through `::part(row-pinned)` wouldn't reach the cells in pinned columns, which paint their own). Default: `--argus-bg`.

- `--argus-row-height` and `--argus-cell-padding-inline` each have a default per density: 32 / 40 / 52 px rows and 8 / 12 / 16 px padding for compact / comfortable / spacious; see [Styling and theming](06-styling-and-theming.md).
- The element is 400 px tall by default, because a virtualized table needs a bounded height; set `height` (or `block-size`) on it.
- `--argus-row-selected-bg` is reserved for row selection (after v0.1). The table doesn't read it yet; themes may set it already.
- `--argus-focus-ring` is an `outline` value for the focused cell or header (`:focus-visible`). Default: `2px solid Highlight`.
- `--argus-pinned-shadow` takes a `box-shadow` value written for a shadow falling toward the end side, for example `4px 0 6px -4px rgb(0 0 0 / .2)`. The component mirrors it for the end edge and in RTL. `none` removes it.
