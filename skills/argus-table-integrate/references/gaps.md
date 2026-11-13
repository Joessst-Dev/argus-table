# Gaps

Features of other tables that argus-table doesn't have. For each: what to tell the user, and what you can offer. Name them before any edit (workflow B2). If a screen depends on one of the hard gaps (editing, row grouping, tree data, master/detail, range selection), recommend keeping the old table on that screen and migrating the others.

## pagination

argus-table scrolls instead of paging: it virtualizes rows, so 100k rows scroll as smoothly as 50. There are no page buttons.

- **Client data:** pass all rows as `data` and drop the paginator. Users scroll; search and filters narrow the rows.
- **Server data:** a `dataSource` loads pages as they scroll into view ([server-data.md](server-data.md)), with the same API.
- **If the user needs page numbers** (a requirement, a "page 3 of 10" link): keep the paginator outside the table and pass one page as `data`. Virtualization doesn't matter for 25–100 rows; sorting and filtering then apply to that page only (or let the server do them, as before).

## editing

No cell editing: no editors, no edit mode, no cell validation.

- Read-only screens move as they are.
- **Workarounds:** a `cell` with a real input (`<input>`, a select, a checkbox) that writes to your data and replaces `data` (clicks on inputs don't select the row or start a drag; check the arrow keys in the input, since the grid uses them to move between cells); or a row action that opens an edit form or dialog. Both work well for a few editable columns. Spreadsheet-like editing (type to edit, Enter to commit, fill handle, undo) does not.
- Keep the old grid on screens built around editing.

## row-grouping

No grouping by column values, no group rows, no aggregation, no pivot.

- **Workarounds:** sort by the group column and render it as the first column; compute group totals and show them in `pinnedRows.bottom` (one total row) or a summary outside the table; for a few groups, one table per group.
- Keep the old grid when users collapse and expand groups.

## tree-data

No hierarchical rows (sub-rows, `getSubRows`, `treeData`, expand/collapse).

- **Workaround:** flatten the tree with a depth per row, indent the first column's `cell` by depth, and show or hide children by filtering `data` when a toggle button in the cell is clicked (keep the expanded ids in state). Works for small trees; sorting then sorts across levels unless you sort within parents yourself.

## master-detail

No expandable detail rows (detail panels, `expandedRowRender`, `show-expand`).

- **Workarounds:** show the detail in a side panel or a dialog on `row-click` (often better for keyboard users); or a `cell` that opens a popover. Rows have one height per row (`rowHeight: 'auto'` grows them to their content), but a full-width detail row inside the grid isn't possible.

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
