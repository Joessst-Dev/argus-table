---
'argus-table': minor
---

Keyboard navigation and click events. The grid is one tab stop (roving tabindex): it starts on the first header, the arrow keys move between cells and between the header and the body (Left and Right are mirrored in RTL), and Home and End jump to the first or last cell of the row. The focused row stays rendered while it is scrolled out of view, so focus survives virtualization, and it stays on the same row when sorting changes the order. Focused cells show `--argus-focus-ring`. Keys pressed in content inside a cell are left to that content. Clicks in the body fire `argus-cell-click` `{ row, columnId, value }` and then `argus-row-click` `{ row, rowId, index }`; both are exported as `CELL_CLICK` and `ROW_CLICK`.
