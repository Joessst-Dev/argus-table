---
'argus-table': minor
---

Auto column widths: a column with `width: 'auto'` fits its content: the header, the pinned rows and the rows in view, within `minWidth` and `maxWidth`. It measures once the first rows render and then keeps its width, so scrolling or new data never move the columns. Templates and components in cells are measured as rendered.

- Double-click a column's resize handle to fit it to the rows in view.
- `autosizeColumns(ids?)` fits several columns at once (default: every resizable column).
- Both count as resizes: they update `columnSizing` (or only propose it, when you control it) and fire `argus-column-resize`, once per column that changes.
- A press on a resize handle without dragging no longer changes the column's width. Before, it fixed a `{ flex }` column at its current width and fired `argus-column-resize`.
