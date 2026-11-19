---
'@argus-table/editing': minor
---

Editing works in tables with tree rows. `argus-cell-edit` carries the row's level as `depth` when the rows form a tree. `applyEdit()` finds rows from `getParentId` in `data` as before; for nested children (`getSubRows`), pass a fourth argument, `{ getSubRows, setSubRows }`, where `setSubRows(row, children)` returns a copy of `row` with those children: the rows on the path to the edited one are copied and every other row stays the same object. Without it, editing a nested child throws an error instead of leaving `data` as it was. A double-click on a control in a cell (a tree row's toggle, or a button, link or input your `cell` renders) no longer opens the editor.
