---
'@argus-table/export': minor
---

Exports can carry each row's detail rows, an order's lines say, through the new `detail` option: their `columns` and `rows(row, { rowId, signal })`, which returns a row's detail rows or a promise of them. Excel writes them under their row, one column in, grouped so they collapse; PDF indents them under their row; CSV writes one line per detail row with the row's values repeated. The data comes from your app, whether or not the table shows `rowDetail` panels. With `detail` in `tableExport()`, the column menu offers Export and Export with details (`labels.withDetails`); `detail: false` leaves the detail rows out of one export.
