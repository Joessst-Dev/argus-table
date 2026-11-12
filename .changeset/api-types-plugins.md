---
'argus-table': minor
---

**Breaking:** attribute, type and plugin API changes for 1.0 (ADR 0004).

- **Boolean attributes:** `virtualize-columns="false"` and `selection-checkboxes="false"` now turn the feature off, like the column flags (`sortable="false"`). Before, any value turned it on.
- **Saved state:**
  - `getState()` now includes `version: 1`. `setState()` ignores state of any other version, with a console warning, and reads state without a version as version 1.
  - `scroll.left` is renamed `scroll.inline`: it is the offset from the start edge, positive in RTL too. A saved `scroll` without `inline` restores only the row.
- **State arrays are `readonly`:** `SortState`, `ColumnOrderState`, `SelectionState` and a set filter's `values`.
- **New type:** `SortDirection` (`'asc' | 'desc'`).
- **Plugins:**
  - Every `PluginHost` member is now required: `columns()`, `setPin()`, `setHidden()`, `setFilter()`, `filterValues()`, `filteredIndexes()`, `row()` and `content()`. You no longer need to check that they exist.
  - `setSort(columnId, undefined)` clears a sort; it used to take `null`.
  - `ColumnInfo.filterValue` is renamed `columnFilter`, and `ColumnInfo.filter` is no longer optional. `ColumnInfo.sorted` is a `SortDirection | undefined`.
  - The `columns` and `columnGroups` hooks see content as `unknown` (`ColumnDef<T, unknown>`), since in React and Vue it is the framework's own content. They may return `undefined` to leave the columns as they are.
  - `willUpdate` gets a `ReadonlySet<string>` of property names.
- `toColumnDef()` and `toColumnGroup()` on `<argus-column>` and `<argus-column-group>` are internal and no longer in the Custom Elements Manifest.
