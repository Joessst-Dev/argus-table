# @argus-table/editing

## 1.3.0

### Minor Changes

- d211726: New add-on `@argus-table/editing` (ADR 0009): cell editing with `cellEditing()`. Columns opt in with `meta: { edit: true }`, or `meta.edit` options for the editor (`'text'`, `'number'`, `'select'`, picked from the column's `filter` kind by default), select `options`, `editable(row)`, `parse`, `validate` and `set`. Enter, F2, typing, Delete or a double-click starts editing; Enter commits and moves down, Tab moves to the next editable cell, Escape cancels. A commit fires `argus-cell-edit` with `{ row, rowId, index, columnId, value, previous, pinned? }`; the app applies it, for example with `applyEdit(data, detail, columns)`. `enterMoves: false` and `typeToEdit: false` switch to data-grid behaviour.
- 526251a: More editors in `cellEditing()`:

  - `'date'`: a date input, picked by default for `filter: 'date'` columns. A `Date` value stays a `Date` (at local midnight), a `yyyy-mm-dd` string stays a string, and empty is `null`.
  - `'checkbox'`: toggles a boolean with a click, Space, Enter or F2 and commits right away, without an editing mode. The cell shows the checkbox unless the column has its own `cell`.
  - Custom editors: `meta.edit.editor` as a function returns the cell's content while it is edited (a Lit template, a node, or a framework component through the wrappers), with `{ value, row, rowId, columnId, label, commit(value), cancel() }`.

### Patch Changes

- Updated dependencies [39d2808]
- Updated dependencies [afb3792]
- Updated dependencies [71eb419]
- Updated dependencies [077fbf6]
- Updated dependencies [9350927]
  - argus-table@1.3.0
