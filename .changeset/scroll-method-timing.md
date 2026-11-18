---
'argus-table': patch
---

Internal: `scrollToRow()` and `scrollToColumn()` read their options and `virtualizeColumns` once the pending update is done again, as they did before the element was split up. Nothing changes for apps.
