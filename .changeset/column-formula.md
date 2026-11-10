---
'argus-table': minor
---

Columns take a `formula` (and `<argus-column>` a `formula` attribute) for the new `@argus-table/formulas` plugin, which computes the column from other columns. Without the plugin the table ignores it.

Fixed: when a column kept its `id` but got a different `accessor`, cells kept showing the old values and the rows kept their old sort order until `data` changed. They now follow the new accessor.
