---
'argus-table': minor
---

Two plugin additions for columns computed from more than their definitions:

- The `willUpdate(changed, host)` hook runs at the start of each update with the names of the properties that changed, before the `columns` hooks. A `host.invalidateColumns()` there runs `columns` again in the same update.
- `host.filteredIndexes(except?)` gives the indexes in `data` of the rows the filters and the quick filter keep, leaving out the filters on the `except` columns and their text in the quick filter. An accessor of one of those columns may call it while the table filters or sorts.
