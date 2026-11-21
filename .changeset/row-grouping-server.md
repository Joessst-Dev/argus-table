---
'argus-table': minor
'@argus-table/header-menu': patch
'@argus-table/formulas': patch
---

Row grouping with a `dataSource`: the server groups. `getRows` now gets `grouping` and `groupPath` (the group a request fills: `[]` for the top-level groups); answer a level of groups with `groups` (each `{ value, count, totals }`, and `rows: []`) and a group's rows with `rows`, as before. Top-level groups, the groups inside an open group and an open group's rows all load page by page as they scroll into view, with Retry on a failed page and `groupPath` in `argus-load-error`. New types `GroupData` and `GroupPathItem`. The column menu's Group by this column is offered with a `dataSource` too (not with `hasChildren` and `getChildren`). With a `dataSource`, formula columns can be grouped by only with `formulas({ server: true })`, like sorting and filtering, and changing such a column's formula while the rows are grouped by it reloads them.
