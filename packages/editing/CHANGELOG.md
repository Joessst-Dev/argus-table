# @argus-table/editing

## 1.4.0

### Minor Changes

- c2a7b25: Editing works in tables with tree rows. `argus-cell-edit` carries the row's level as `depth` when the rows form a tree. `applyEdit()` finds rows from `getParentId` in `data` as before; for nested children (`getSubRows`), pass a fourth argument, `{ getSubRows, setSubRows }`, where `setSubRows(row, children)` returns a copy of `row` with those children: the rows on the path to the edited one are copied and every other row stays the same object. Without it, editing a nested child throws an error instead of leaving `data` as it was. A double-click on a control in a cell (a tree row's toggle, or a button, link or input your `cell` renders) no longer opens the editor.

### Patch Changes

- 85b7be9: `applyEdit()` takes the detail of `argus-cell-edit` as a plain `<argus-table>` fires it, and columns from the React, Vue and Angular wrappers. `table.data = applyEdit(table.data, event.detail, columns)` no longer fails to type-check on a typed table, or with `ReactColumnDef`, `VueColumnDef` and `AngularColumnDef` columns. Nothing changes at runtime.
- 6d8f676: Grouped tables (`grouping`): export writes every row in grouped order, rows of closed groups too; cell editing leaves group rows alone, so Enter opens or closes them.
- Updated dependencies [8b2eae8]
- Updated dependencies [cae43e9]
- Updated dependencies [2579957]
- Updated dependencies [e221ebc]
- Updated dependencies [471c332]
- Updated dependencies [6c95cdc]
- Updated dependencies [8379a67]
- Updated dependencies [ae76b1f]
- Updated dependencies [6d8f676]
- Updated dependencies [1c85328]
- Updated dependencies [97b07e5]
- Updated dependencies [c2a7b25]
- Updated dependencies [de99bdf]
- Updated dependencies [b99de54]
- Updated dependencies [9b43ccd]
- Updated dependencies [2e5bf03]
- Updated dependencies [8714311]
- Updated dependencies [8e8cec0]
- Updated dependencies [8523ab5]
- Updated dependencies [7cbe470]
- Updated dependencies [c2a7b25]
- Updated dependencies [5f230e2]
  - argus-table@1.4.0

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
