---
'argus-table': minor
---

A checkbox column for row selection. Add `selection-checkboxes` (the `selectionCheckboxes` property) to a table with a `selectionMode`:

```html
<argus-table selection-mode="multi" selection-checkboxes></argus-table>
```

- The column comes first, pinned to the start. A row's checkbox selects or deselects that row and keeps the others, and Shift+click adds the range from the last row clicked.
- In `multi` mode the header has a select-all checkbox. It's checked when every row is selected and mixed when some are. A click selects every row, or clears the selection when all are selected. With a `dataSource` it covers the rows loaded so far.
- Space on a focused checkbox cell, or on the header, does the same as clicking its checkbox. The checkboxes don't take focus themselves, so the arrow keys keep working.
- The column isn't one of your `columns`. It isn't in `columnOrder` or `columnSizing`, can't be sorted, resized or moved, and clicks in it fire no `argus-cell-click` or `argus-row-click`. Its id, `--argus-selection`, is reserved.
- New parts: `cell-selection`, `header-cell-selection`, and `selection-checkbox` on the checkboxes, so `::part(selection-checkbox) { accent-color: … }` colours them.

Also: Ctrl+A (Cmd+A) now adds every row to the selection instead of replacing it, so ids selected on `dataSource` pages that were dropped from memory stay selected.
