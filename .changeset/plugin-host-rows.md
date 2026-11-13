---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Plugins can read the table's rows, values and group headers, as the new export add-on does:

- `host.rowCount(section?)`, `host.rowId(index, section?)` and `host.value(index, columnId, section?)` read the body rows in the order shown (after sorting and filtering), or the rows pinned to the `'top'` or `'bottom'`. `value()` is what the column's `accessor` reads, hidden columns too. With a `dataSource`, rows that aren't loaded have no id or value.
- `host.row(index, section?)` takes the section too.
- `host.readValue(row, columnId, index)` applies a column's `accessor` to a row the plugin has itself, such as one it fetched from the `dataSource`.
- `host.headerGroups()` lists the group header rows over the shown columns: each cell's group id (or none, over columns without a group) and its columns.
- `ColumnInfo` (from `host.column()` and `host.columns()`) has the column's `align`.
- New types: `RowSection` and `HeaderGroupInfo`, also exported by the React, Vue and Angular wrappers.
