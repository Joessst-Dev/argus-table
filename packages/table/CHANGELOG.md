# argus-table

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
