---
'@argus-table/editing': minor
---

More editors in `cellEditing()`:

- `'date'`: a date input, picked by default for `filter: 'date'` columns. A `Date` value stays a `Date` (at local midnight), a `yyyy-mm-dd` string stays a string, and empty is `null`.
- `'checkbox'`: toggles a boolean with a click, Space, Enter or F2 and commits right away, without an editing mode. The cell shows the checkbox unless the column has its own `cell`.
- Custom editors: `meta.edit.editor` as a function returns the cell's content while it is edited (a Lit template, a node, or a framework component through the wrappers), with `{ value, row, rowId, columnId, label, commit(value), cancel() }`.
