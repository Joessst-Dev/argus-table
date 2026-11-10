---
'@argus-table/header-menu': minor
---

The column menu filters. Columns with a `filter` kind get **Filter…**, which opens a small form under the header: a condition and a value for text, a comparison or a range for numbers and dates, or a searchable checklist of the values for a `set` (the values the other filters leave, or the column's `filterOptions` with a `dataSource`). Typed values apply as typing pauses; Enter or Done closes the form, Escape closes it as it is, and Clear (or **Clear filter** in the menu) removes the filter. It sets the table's `columnFilters`, so a controlled table only gets `argus-column-filter`. `headerMenu({ filter: false })` turns it off. Style the form through the `argus-header-filter` classes; it takes the menu's tokens.
