---
'@argus-table/formulas': minor
---

Whole columns in formulas. `[[amount]]` is every value of a column in the rows the table's filters keep (as Excel's `SUBTOTAL` counts them), while `[amount]` stays the row's own value:

```text
Share    = [amount] / SUM([[amount]])
Orders   = COUNTIF([[customer]], [customer])
Manager  = XLOOKUP([manager_id], [[id]], [[name]], "—")
Position = RANK([amount], [[amount]])
```

- `SUM`, `MIN`, `MAX` and `AVERAGE` take whole columns, and the new Columns functions are `COUNT`, `COUNTA`, `COUNTBLANK`, `SUMIF`, `COUNTIF`, `AVERAGEIF` (criteria such as `">10"`, `"<>done"` or wildcards), `XLOOKUP`, `MATCH`, `INDEX` and `RANK`.
- Totals follow the filters, the quick filter and new `data`. Filters on a column that uses whole columns hide rows without changing its totals.
- A total such as `SUM([[amount]])` is computed once per set of rows, and criteria and lookups that change from row to row use an index of the column, so they stay fast on large tables.
- With a `dataSource`, whole columns are `#N/A`.
- The editor suggests columns after `[[`, highlights whole columns, and notes `SUM([amount])` (one value of the row) without blocking the save.

The plugin's size budget grows from 9 to 12.3 kB min+gzip.
