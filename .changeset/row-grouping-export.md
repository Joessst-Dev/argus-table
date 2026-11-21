---
'@argus-table/export': minor
'argus-table': patch
---

Grouped export: a grouped table's group rows are exported with its rows, each with the group's value and number of rows in the first column (new labels `groupRow` and `emptyGroup`) and its totals in the others. Excel puts every row at its group's outline level so the groups collapse, PDF shades group rows and indents each level, CSV writes them as lines. With a `dataSource`: the loaded rows, or with `allRows` the top-level groups. `PluginHost.groupedRows()` now lists the group rows too, with each row's depth.
