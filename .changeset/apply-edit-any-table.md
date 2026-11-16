---
'@argus-table/editing': patch
---

`applyEdit()` takes the detail of `argus-cell-edit` as a plain `<argus-table>` fires it, and columns from the React, Vue and Angular wrappers. `table.data = applyEdit(table.data, event.detail, columns)` no longer fails to type-check on a typed table, or with `ReactColumnDef`, `VueColumnDef` and `AngularColumnDef` columns. Nothing changes at runtime.
