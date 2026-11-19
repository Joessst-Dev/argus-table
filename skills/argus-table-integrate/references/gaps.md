# Gaps

Features of other tables that argus-table doesn't have. For each: what to tell the user, and what you can offer. Name them before any edit (workflow B2). If a screen depends on one of the hard gaps (row grouping, range selection), recommend keeping the old table on that screen and migrating the others.

## pagination

argus-table scrolls instead of paging: it virtualizes rows, so 100k rows scroll as smoothly as 50. There are no page buttons.

- **Client data:** pass all rows as `data` and drop the paginator. Users scroll; search and filters narrow the rows.
- **Server data:** a `dataSource` loads pages as they scroll into view ([server-data.md](server-data.md)), with the same API.
- **If the user needs page numbers** (a requirement, a "page 3 of 10" link): keep the paginator outside the table and pass one page as `data`. Virtualization doesn't matter for 25–100 rows; sorting and filtering then apply to that page only (or let the server do them, as before).

## row-grouping

No grouping by column values, no group rows, no aggregation, no pivot.

- **Workarounds:** sort by the group column and render it as the first column; compute group totals and show them in `pinnedRows.bottom` (one total row) or a summary outside the table; for a few groups, one table per group.
- Keep the old grid when users collapse and expand groups.

## lazy-trees

Tree rows held in memory are supported since 1.4: nested children with `getSubRows`, or flat rows with `getParentId`, expanded with `treeExpanded` (see the library's guide). Trees whose children load from the server when a row is expanded are not, yet: Element Plus `lazy` with `:load`, PrimeNG/PrimeVue lazy tree tables (`onNodeExpand` loading children), AG Grid's server-side tree data (`isServerSideGroup`, `getServerSideGroupKey`), MUI X lazy-loaded tree data (a data source with `getChildrenCount`). With a `dataSource`, `getSubRows` and `getParentId` are ignored (with a console warning) and the rows show flat; children from the server are planned for a later release.

- **Ask first:** how many rows the whole tree has, and whether the server can return it in one request (or could, with a new endpoint). Offer the workaround only when it can.
- **Workaround:** load the whole tree (every row, or every row with its parent's id) and pass it as `data` with `getSubRows` or `getParentId`. The table virtualizes the shown rows and sorts and filters within the tree itself; what limits this is loading the whole tree in one request.
- Keep the old table when the tree is too large to load at once.

## range-selection

No cell range selection, no clipboard copy of a range, no fill handle. Row selection is supported (`selectionMode`).

- **Workaround:** copy the selected rows: read `selection`, map ids to rows, write TSV with `navigator.clipboard.writeText`. Exports go through `@argus-table/export`.

## row-drag

No row reordering by drag. Columns can be dragged.

- **Workaround:** move buttons (up/down) in an actions column that reorder `data`.

## context-menu

No built-in context menu on cells. The column menu (`@argus-table/header-menu`) opens on headers (also with right-click).

- **Workaround:** listen for `contextmenu` on the cell's own content and open the app's menu component.

## tool-panels

No side bar (column chooser, filter panel) or status bar.

- **Column chooser:** the column menu's "Hidden columns" group, or the app's own panel bound to `columnVisibility` and `columnOrder`.
- **Status bar:** the app's own element next to the table: row count from `data`, selection count from `selection`.

## cell-spanning

No cells spanning rows or columns in the body. Header groups (`columnGroups`) span columns in the header.

- **Workaround:** repeat the value, or blank it in `cell` when it equals the row above (after sorting by it).

## filter-row

No filter row under the headers (floating filters, header filters, `filterDisplay="row"`). Filters are set from the column menu (`@argus-table/header-menu`), or by the app through `columnFilters`.

- **Workaround:** the app's own filter inputs above the table, bound to `columnFilters` (and `quickFilter` for search).

## viewport

AG Grid's viewport row model (the server pushes rows in view) has no equivalent. A `dataSource` pulls pages instead; for live updates, call `refresh()` when the server says rows changed.
