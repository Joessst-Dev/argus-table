---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Tree rows: rows can have child rows, such as a folder and its files or a manager and their team. Give the table `getSubRows`, which returns a row's children (`data` then holds the top-level rows), or, for flat data where each row names its parent, `getParentId`. A row with children gets a toggle in the first data column, and each level is indented under its parent. Child rows are rows like any other: they have cells in every column, and they sort among their siblings, filter, select, fire click events, open detail panels and scroll into view. A filter or the quick filter keeps the rows that match with their ancestors, so a match always shows in its place: those ancestors show expanded, with their toggles disabled until the filter clears.

`treeExpanded` (row ids, in `getState()` too) says which rows are expanded: uncontrolled until set, with `argus-tree-expanded-change` (`{ treeExpanded, rowId, open }`) for each change. Without `getRowId`, a child's id is its parent's id, a dot and its index among its siblings (`'3.0'`); top-level rows keep their index in `data`. `getRowId` and a column's `accessor` get a nested child's index counted from `data.length` on. Every other index (`scrollToRow`, click events, `argus-range-change`) counts the rows shown, so expanding a row moves the indexes below it. Cell functions, `rowDetail`, `argus-cell-click` and `argus-row-click` get the row's level as `depth`, set only when the rows form a tree. Plugins get `host.rowDepth()` and `host.sourceRow()`.

From the keyboard, on a cell of the first data column, ArrowRight expands a collapsed row and ArrowLeft collapses an expanded one or goes to the parent row (mirrored in right-to-left tables); Enter keeps its meaning. The table becomes a WAI-ARIA `treegrid`, and rows carry their level, whether they're expanded and their place among their siblings, for screen readers.

`selectBranches` (attribute `select-branches`, in `selectionMode: 'multi'`) selects whole branches: ticking a row selects it and every row under it that the filters keep, a row's id is in `selection` while its whole branch is, and a row with part of its branch selected shows a part-ticked checkbox. Select-all then covers every row the filters keep, collapsed or not.

Styling: the toggle is the `tree-toggle` part (with `tree-toggle-disabled` while a filter keeps its row open), and `--argus-tree-indent` (1.25rem) sets the indent per level. New labels: `expandTreeRow`, `collapseTreeRow`. With a `dataSource`, `getSubRows` and `getParentId` are ignored for now (the rows show flat, with a console warning).

In the wrappers, `treeExpanded` binds two-way (`onTreeExpandedChange`, `v-model:tree-expanded`, `[(treeExpanded)]`), Angular cell and detail templates get `depth`, and `TreeExpandedState` and `TreeExpandedChangeDetail` are exported.
