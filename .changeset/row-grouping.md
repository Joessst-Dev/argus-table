---
'argus-table': minor
---

Row grouping: group rows by the values of one or more columns with `grouping` and `ColumnDef.groupable`. Each group shows as a row with its value and its number of rows, opens and closes like a tree row (its id goes into `treeExpanded`; Enter on any of its cells toggles it), and shows per-column totals from `ColumnDef.aggregate` (`'sum'`, `'avg'`, `'min'`, `'max'`, `'count'` or a function). `ColumnDef.groupCell` renders a column's cells on group rows. Groups follow their values; sorting by a column with a total orders them by it. In `multi` mode a group's checkbox ticks its rows. `grouping` is controllable (`argus-grouping-change`) and saved by `getState()`. New parts `row-group`, `cell-group` and `group-count`, and labels `groupCount` and `emptyGroup`. Plugins get `host.grouping()`, `host.setGrouping()`, `host.group()` and `host.groupedRows()`. Rows from a `dataSource` can't be grouped yet: `grouping` is ignored there, with a warning.
