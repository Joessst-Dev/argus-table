---
'argus-table': patch
---

Internal: how rows are arranged (flat rows, tree rows, a data source's rows and its tree) comes from one row structure in the table model, and the table reads it there instead of from where the rows come from. Nothing changes for apps.
