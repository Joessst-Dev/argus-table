---
'argus-table': minor
---

Column reordering: drag a header to move its column. A line shows where it will land, and Escape cancels the drag. Columns move within their own group: start-pinned columns among themselves, scrolling columns among theirs, end-pinned columns among theirs. Dragging a scrolling column toward the table's edge scrolls the table.

- From the keyboard, focus a header and press Alt+Shift+Arrow to move it one place (mirrored in right-to-left layouts). Focus stays on the header, and screen readers hear where it went, for example "Customer moved to column 3 of 8".
- `columnOrder` holds the order as column ids, and `argus-column-reorder` fires with `{ columnId, order }` after each move. Like `sorting` and `columnSizing`, it is uncontrolled until you set it. Once you set it, a move only proposes the new order, so you can save it and restore it later.
- `reorderable: false` on a column keeps it from being dragged or moved. Other columns can still move past it.
- New parts `header-cell-dragging` and `drop-indicator`, and a new token `--argus-drop-indicator-color`.
- A drag on a header starts after the pointer moves a few pixels, so a click still sorts. Header text can no longer be selected by dragging across it.
