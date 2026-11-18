---
'argus-table': patch
---

Sorting by a number or date column is several times faster on large tables: a million rows sort in about 75 ms instead of 325 ms, and by a date then a number in 110 ms instead of 790 ms (measured in Node). The order is the same as before.
