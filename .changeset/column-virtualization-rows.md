---
'argus-table': patch
---

Fix `virtualizeColumns`: after scrolling sideways, cells no longer wrap onto extra lines within their row, which left the table overlapping and unreadable. Each cell now stays on its row's line.
