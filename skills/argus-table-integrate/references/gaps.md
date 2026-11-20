# Gaps

Features of other tables that argus-table doesn't have. For each: what to tell the user, and what you can offer. Name them before any edit (workflow B2). If a screen depends on one of the hard gaps (pivoting or server-side row grouping, range selection), recommend keeping the old table on that screen and migrating the others.

## pagination

argus-table scrolls instead of paging: it virtualizes rows, so 100k rows scroll as smoothly as 50. There are no page buttons.

- **Client data:** pass all rows as `data` and drop the paginator. Users scroll; search and filters narrow the rows.
- **Server data:** a `dataSource` loads pages as they scroll into view ([server-data.md](server-data.md)), with the same API.
- **If the user needs page numbers** (a requirement, a "page 3 of 10" link): keep the paginator outside the table and pass one page as `data`. Virtualization doesn't matter for 25–100 rows; sorting and filtering then apply to that page only (or let the server do them, as before).

## row-grouping

Rows in memory (`data`) group by column values, with counts and totals per group (`grouping`, `groupable`, `aggregate`, `groupCell`; Since 1.4). Missing: grouping with a `dataSource` (server-side grouping), pivoting, a drag-to-group panel, grouping combined with tree rows, and selecting or editing a group row itself.

- **Server-side grouping:** if the rows fit in memory, load them as `data` and group in the table; otherwise keep the old grid on that screen for now.
- **Pivoting:** compute the pivoted rows in the app and show them as ordinary rows and columns.
- **A grand total:** one row in `pinnedRows.bottom`.

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
