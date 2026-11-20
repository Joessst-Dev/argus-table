---
'argus-table': minor
'@argus-table/header-menu': patch
---

Row grouping with a `dataSource`: the server groups. `getRows` now gets `grouping` and `groupPath` (the group a request fills: `[]` for the top-level groups); answer a level of groups with `groups` (each `{ value, count, totals }`, and `rows: []`) and a group's rows with `rows`, as before. Top-level groups, the groups inside an open group and an open group's rows all load page by page as they scroll into view, with Retry on a failed page and `groupPath` in `argus-load-error`. New types `GroupData` and `GroupPathItem`. The column menu's Group by this column is offered with a `dataSource` too (not with `hasChildren` and `getChildren`).
