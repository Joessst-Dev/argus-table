---
'argus-table': patch
---

The table no longer depends on `@tanstack/table-core`: it keeps its rows itself, as positions in `data`, instead of an object per row. With 1M rows the table's own memory goes from about 297 MB to 5 MB in Chromium, the first rows paint about 30 times sooner after setting `data` (805 → 27 ms in Chromium, 735 → 23 ms in Firefox), and sorting is about a third faster. The CDN bundle is about 9.7 kB smaller gzipped (50.9 → 41.2 kB), and `lit` is the only dependency left. Sorting, filtering, row ids, column widths and every event work as before; sort orders are the same, since the sort functions were carried over unchanged.
