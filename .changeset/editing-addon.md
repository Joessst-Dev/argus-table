---
'@argus-table/editing': minor
---

New add-on `@argus-table/editing` (ADR 0009): cell editing with `cellEditing()`. Columns opt in with `meta: { edit: true }`, or `meta.edit` options for the editor (`'text'`, `'number'`, `'select'`, picked from the column's `filter` kind by default), select `options`, `editable(row)`, `parse`, `validate` and `set`. Enter, F2, typing, Delete or a double-click starts editing; Enter commits and moves down, Tab moves to the next editable cell, Escape cancels. A commit fires `argus-cell-edit` with `{ row, rowId, index, columnId, value, previous, pinned? }`; the app applies it, for example with `applyEdit(data, detail, columns)`. `enterMoves: false` and `typeToEdit: false` switch to data-grid behaviour.
