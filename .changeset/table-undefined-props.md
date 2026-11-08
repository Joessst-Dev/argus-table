---
'argus-table': patch
---

`columns`, `data` and `overscan` now treat `null` and `undefined` as their defaults (`[]`, `[]` and 6) instead of failing. Framework bindings set `undefined` when a prop is removed. The Custom Elements Manifest now has the type of each event's detail.
