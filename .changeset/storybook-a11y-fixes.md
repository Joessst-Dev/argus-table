---
'argus-table': patch
---

`<argus-table>` now also has `role="grid"` as an attribute (unless the page sets its own `role`), so accessibility checkers such as axe-core, which don't read the ElementInternals role, see the grid. The sort chevron no longer points sideways in right-to-left layouts.
