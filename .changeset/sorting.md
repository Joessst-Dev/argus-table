---
'argus-table': minor
---

Sort by a column. Headers of columns with `sortable: true` cycle ascending, descending and unsorted on click, or on Enter and Space when focused. The `sorting` property works uncontrolled (the table keeps the order) or controlled (set it, and a click only proposes the new order through `argus-sort-change`; set `undefined` to hand it back). The sorted header gets `aria-sort` and the `header-cell-sorted` part, its body cells `cell-sorted`, and empty values sort last in both directions.
