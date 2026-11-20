---
'argus-table': patch
---

Tree rows from a `dataSource` render faster: a row's cells share one lookup of where the row sits, instead of one per cell, and `hasChildren` is called once per loaded row instead of on every render.
