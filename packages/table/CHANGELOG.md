# argus-table

## 0.2.2

### Patch Changes

- 8cd61c8: Clicking a header, tabbing into the table, or moving focus through the header or pinned rows no longer scrolls the body in Chromium- and WebKit-based browsers. A header click, for example to sort, used to move the body by several rows. Focused body cells still scroll clear of the header, the pinned rows and the pinned columns.

## 0.2.1

### Patch Changes

- fe9949e: Mouse-wheel scrolling from the top of a table no longer stalls in WebKit. Each wheel step moved only a few pixels until the table had rendered a full window of rows, because every new row's slots cancelled WebKit's scroll animation. The table now renders that full window from the start, with the overscan that has no room at either end on the other side, so scrolling only reuses rows.

## 0.2.0

### Minor Changes

- b9b0b2e: Declarative columns: write columns as `<argus-column>` children instead of setting the `columns` property.

  ```html
  <argus-table>
    <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start"></argus-column>
    <argus-column
      column-id="customer"
      header="Customer"
      accessor="customer.name"
      width="1fr"
      sortable
    ></argus-column>
    <argus-column column-id="actions" header="Actions" width="100" resizable="false">
      <template><button>Open</button></template>
    </argus-column>
  </argus-table>
  ```

  - Attributes cover the plain fields: `column-id`, `header`, `accessor`, `width` (`90`, `auto` or `2fr`), `min-width`, `max-width`, `pin`, `align`, `sortable`, `resizable` and `reorderable` (`resizable="false"` turns resizing off). Functions and rich content go in properties: `accessor`, `header` and `cell`.
  - A `<template>` child is static content for every cell of the column. Use the `cell` property for content that depends on the row.
  - The table follows its children: add, remove or move a column, or change an attribute, and the columns update, keeping widths, order and sorting. Loops in Vue, Angular or React just work.
  - A non-empty `columns` property wins over the children.

- 8f008b3: Auto column widths: a column with `width: 'auto'` fits its content: the header, the pinned rows and the rows in view, within `minWidth` and `maxWidth`. It measures once the first rows render and then keeps its width, so scrolling or new data never move the columns. Templates and components in cells are measured as rendered.

  - Double-click a column's resize handle to fit it to the rows in view.
  - `autosizeColumns(ids?)` fits several columns at once (default: every resizable column).
  - Both count as resizes: they update `columnSizing` (or only propose it, when you control it) and fire `argus-column-resize`, once per column that changes.
  - A press on a resize handle without dragging no longer changes the column's width. Before, it fixed a `{ flex }` column at its current width and fired `argus-column-resize`.

- eebb8a1: Column reordering: drag a header to move its column. A line shows where it will land, and Escape cancels the drag. Columns move within their own group: start-pinned columns among themselves, scrolling columns among theirs, end-pinned columns among theirs. Dragging a scrolling column toward the table's edge scrolls the table.

  - From the keyboard, focus a header and press Alt+Shift+Arrow to move it one place (mirrored in right-to-left layouts). Focus stays on the header, and screen readers hear where it went, for example "Customer moved to column 3 of 8".
  - `columnOrder` holds the order as column ids, and `argus-column-reorder` fires with `{ columnId, order }` after each move. Like `sorting` and `columnSizing`, it is uncontrolled until you set it. Once you set it, a move only proposes the new order, so you can save it and restore it later.
  - `reorderable: false` on a column keeps it from being dragged or moved. Other columns can still move past it.
  - New parts `header-cell-dragging` and `drop-indicator`, and a new token `--argus-drop-indicator-color`.
  - A drag on a header starts after the pointer moves a few pixels, so a click still sorts. Header text can no longer be selected by dragging across it.

- d86671c: Infinite loading: set `dataSource` instead of `data` to load rows from a server, page by page, as they scroll into view. `getRows({ start, end, sorting, signal })` gets the rows to load (`end` exclusive, like `slice`) and resolves to `{ rows, total? }`; `pageSize` sets the page size (default 100).

  - Only the pages in view are requested, once scrolling settles, so a fast fling loads only where it stops. Requests for pages that scroll away are aborted through `signal`.
  - Rows still loading show skeleton bars (parts `row-loading` and `skeleton`, colour `--argus-skeleton-bg`). The bars pulse, except with reduced motion.
  - Without a `total`, the table grows as pages arrive and ends at a page with fewer rows than it asked for. Screen readers hear an unknown row count until then.
  - Sorting happens on the server: `sorting` comes with every request, and a new order reloads from the top.
  - A page that fails fires `argus-load-error` (`{ error, start, end }`, also exported as `LOAD_ERROR`) and shows a Retry button (part `retry`) in its first visible row. Enter on a cell of a failed row retries too.
  - New method `refresh()`: drops the loaded pages and loads the rows in view again, keeping the scroll position.

- 8550539: More keyboard navigation in the grid. PageDown and PageUp move focus by a page of rows (the rows that fit below the header) in the same column, and the view scrolls with it, so the focused cell keeps its place on screen. Ctrl+Home jumps to the first header and scrolls to the top, and Ctrl+End jumps to the last row's last cell, even 100,000 rows down. Cmd+Home and Cmd+End do the same on macOS. As before, keys pressed inside cell content are left to that content.
- aa1a40b: Pinned rows: `pinnedRows: { top?, bottom? }` keeps rows fixed below the header or at the bottom of the view while the body scrolls, for a totals or summary row. They are separate objects, not rows of `data`: the columns read them as usual, they are never sorted, and they work the same with a `dataSource`.

  - A column's `cell` function gets `pinned: 'top' | 'bottom'` in its context, so it can show a summary row its own way.
  - The keyboard moves through them like any row: from the header into the top rows, the body, and on to the bottom rows; Ctrl+End lands on the last one. PageUp and PageDown page through the body only.
  - Clicks and Enter on them fire `argus-cell-click` and `argus-row-click`, with `pinned` in the detail and `index` counted within their list.
  - New parts `row-pinned`, `row-pinned-top`, `row-pinned-bottom` and `cell-pinned-row`, and a new token `--argus-pinned-row-bg` for their background.
  - Screen readers count them as rows: the first body row's `aria-rowindex` now comes after the top pinned rows.

- 6b33bbc: Any number of rows now scrolls to the last one. Browsers limit how tall an element can be (about 33.5M px in Chromium and Safari, 17.9M px in Firefox), so before, the last rows of a very large table couldn't be reached: from about 840k rows of 40 px in Chromium and Safari, and in Firefox a table of more than about 450k rows didn't scroll at all. Past the browser's limit the table now renders a shorter body and scales the scroll position onto the rows: the scrollbar still spans every row, and a wheel step covers proportionally more of them. Keyboard navigation, `scrollToRow()` and focus keep working as before. Smaller tables are unchanged.
- 19012fe: New `--argus-radius` and `--argus-outline` tokens. `--argus-radius` rounds the table's corners, and the header, rows and pinned columns are clipped to them. `--argus-outline` draws a border around the whole table, as a `border` shorthand such as `1px solid #ddd`. By default the table stays square with no border.

### Patch Changes

- 2b954bf: The CDN build (`dist/cdn/argus-table.js`) is now fully minified and about 5 kB smaller gzipped. The npm build that bundlers use is unchanged.
- a5aa931: Sorting large tables is much faster, most of all in Firefox: sorting 1M rows took over a minute there and now takes under a second (Chromium: about 2.6 s, now about 0.65 s).
- 0f5a5a6: `columns`, `data` and `overscan` now treat `null` and `undefined` as their defaults (`[]`, `[]` and 6) instead of failing. Framework bindings set `undefined` when a prop is removed. The Custom Elements Manifest now has the type of each event's detail.

## 0.1.0

### Minor Changes

- 619ebe5: Ship a CDN build and bundled type declarations.

  - `dist/cdn/argus-table.js` is one minified ES module with Lit and TanStack inlined, for use straight from jsDelivr or unpkg (`<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table">`).
  - The type declarations are one `dist/index.d.ts` with no import of internal packages.

- e382ee9: Resize columns. Resizable columns (the default) get a `resize-handle` on their header's inline-end edge: drag it, or press Alt+Arrow on a focused header for 10 px steps, mirrored in RTL. Widths stay within `minWidth` and `maxWidth`, and a resized flex column becomes fixed. The `columnSizing` property works uncontrolled or controlled like `sorting`, and `argus-column-resize` carries `{ columnId, width, sizing }` on every change, including each frame of a drag. The handle's line uses `--argus-resize-handle-color`.
- 63985c4: Enter on a focused body cell fires `argus-cell-click` and then `argus-row-click`, as a mouse click does. Enter pressed in content inside a cell (an input, a button) is left to that content.
- 8015153: Keyboard navigation and click events. The grid is one tab stop (roving tabindex): it starts on the first header, the arrow keys move between cells and between the header and the body (Left and Right are mirrored in RTL), and Home and End jump to the first or last cell of the row. The focused row stays rendered while it is scrolled out of view, so focus survives virtualization, and it stays on the same row when sorting changes the order. Focused cells show `--argus-focus-ring`. Keys pressed in content inside a cell are left to that content. Clicks in the body fire `argus-cell-click` `{ row, columnId, value }` and then `argus-row-click` `{ row, rowId, index }`; both are exported as `CELL_CLICK` and `ROW_CLICK`.
- 66d9155: Pin columns with `pin: 'start'` or `pin: 'end'`. Pinned header and body cells stay in place while the other columns scroll sideways, in LTR and RTL. Body cells in pinned columns get the `cell-pinned` part, and the one next to the scrolling columns also gets `cell-pinned-edge`, with a shadow from `--argus-pinned-shadow` (mirrored for the end side and in RTL; `none` removes it).
- 173c543: Render columns and data. `<argus-table>` now takes `columns`, `data`, `getRowId`, `rowHeight`, `density` and `overscan`, virtualizes rows (100,000 rows keep a small, bounded DOM), slots header and cell content from the light DOM (templates, DOM nodes, strings or numbers), exposes the grid to assistive tech with `aria-rowcount`, `aria-rowindex` and `aria-colindex`, fires `argus-range-change`, and adds `scrollToRow(index)`, the `empty` slot, the structural parts and the first tokens.
- 8d2d1a7: Sort by a column. Headers of columns with `sortable: true` cycle ascending, descending and unsorted on click, or on Enter and Space when focused. The `sorting` property works uncontrolled (the table keeps the order) or controlled (set it, and a click only proposes the new order through `argus-sort-change`; set `undefined` to hand it back). The sorted header gets `aria-sort` and the `header-cell-sorted` part, its body cells `cell-sorted`, and empty values sort last in both directions.

### Patch Changes

- ef3fdb9: New package `@argus-table/themes` with the default theme, `@argus-table/themes/default.css`. It is neutral: it uses the page's font, follows the system's light or dark setting through `light-dark()`, and uses one accent colour for focus, the sorted header and the resize handle. Put `data-argus-theme="dark"` or `"light"` on the table or an ancestor to force a scheme. The theme sets only tokens and `::part()` rules, so any token can be overridden after it. `argus-table` documents `--argus-row-selected-bg` as reserved for row selection; the table doesn't read it yet.
- 55f76be: Smaller bundle: the element's styles now ship minified (about 0.6 kB less gzipped in the CDN build). They render the same.
- 63985c4: The grid is one tab stop in Firefox too. Firefox makes the scroll container a tab stop of its own; Tab into the grid now moves straight on to the active cell, and Shift+Tab leaves the grid without stopping on the container.
- c2afe97: Pinned columns no longer make vertical scrolling stutter in Safari. Pinned body cells are now sticky only while the table scrolls sideways, and the pinned edge's shadow is drawn once per side instead of on every row. Nothing changes in the DOM, the accessibility tree, the `cell-pinned` and `cell-pinned-edge` parts, or `--argus-pinned-shadow`.
- 0269a6e: `<argus-table>` now also has `role="grid"` as an attribute (unless the page sets its own `role`), so accessibility checkers such as axe-core, which don't read the ElementInternals role, see the grid. The sort chevron no longer points sideways in right-to-left layouts.
