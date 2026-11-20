---
'@argus-table/header-menu': minor
---

The column menu groups rows: Group by this column on a column with `groupable` makes it the innermost level of the table's `grouping`, and Ungroup removes it, announced through the new `grouped` and `ungrouped` labels (`groupBy` and `ungroup` name the items). `headerMenu({ group: false })` leaves them out. Not offered with tree rows or a `dataSource`.
