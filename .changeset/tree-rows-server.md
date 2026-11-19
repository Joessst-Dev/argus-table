---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Tree rows from a `dataSource`: a row's children can load from the server when it's expanded. Give the data source `hasChildren(row)`, which says whether a row has children (it gets a toggle), and `getChildren({ parent, parentId, sorting, filters, quickFilter, signal })`, which resolves to `{ rows }` with all of the row's children, sorted and filtered like the rows. Both are needed; with only one the rows stay flat. `getRows` keeps returning the top-level rows (its `start`, `end` and `total` count those), and children can have children of their own, loaded the same way. Everything else works as for tree rows held in memory: `treeExpanded` and its event, the toggle, the keys, the treegrid ARIA, `depth` in cell functions and click events, and `scrollToRow()`, the click events and `argus-range-change` counting the rows shown.

Expanding a row calls `getChildren` once; until it answers, a loading row shows under the row. Children stay loaded when the row collapses. A new source, sort, filters, quick filter or `getRowId`, or `refresh()`, drops them (requests in flight are aborted through `signal`) and the expanded rows load theirs again; after a sort or `refresh()`, each shows as many loading rows as it showed rows under it, so the rows below don't jump. A `treeExpanded` restored with `setState()` opens rows as their pages load. Children that come back empty remove the row's toggle. Without `getRowId`, a child's id is its parent's id, a dot and its index among its siblings (`'3.0'`); with it, `getRowId` gets that index. The server filters at every level, so with a `dataSource` a filter opens no rows by itself.

When `getChildren` rejects, a row with a Retry button shows under the row (its accessible name is the new `retryChildren` label, "Retry loading child rows") and `argus-load-error` fires with the row's id as the new `parentId`, `start` its index among the rows shown (`-1` while a collapsed ancestor hides it) and `end` the next one. Retry, or expanding the row again, asks again. With tree rows, a failed page's `start` and `end` count the rows shown too.

With `selectBranches`, ticking a row selects the loaded rows under it, and children that load under a ticked row join the selection (with an `argus-selection-change`). While a filter or the quick filter is on, a row's own id isn't selected, since the server may not have sent all of its children, and a row whose children haven't loaded can't be ticked until they do.

The wrappers export the `ChildrenRequest` and `ChildrenResponse` types.
