---
'@argus-table/formulas': patch
---

Formula columns can be filtered like other columns (an error counts as an empty value), and the table's quick filter finds their results. With a `dataSource` they can't be filtered, as they can't be sorted: the server doesn't know the formulas.
