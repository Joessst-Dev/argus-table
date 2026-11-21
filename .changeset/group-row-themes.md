---
'argus-table': patch
'@argus-table/themes': minor
---

Group rows (`grouping`) get their own background: the new `--argus-row-group-bg` token, which every shipped theme sets (like its pinned rows, or a light tint). `GroupRowInfo` and `GroupCellContext` name the group's id `rowId`, like `CellContext`.
