---
'@argus-table/header-menu': minor
---

The column menu pins and hides columns. Every column's menu now has **Pin to start**, **Pin to end** and **Don't pin**, and **Hide column**, and while columns are hidden, a **Hidden columns** group shows them again (one at a time, or **Show all**). They set the table's `columnPinning` and `columnVisibility`, or only fire `argus-column-pin` and `argus-column-hide` when you control those. Pinning, hiding and showing are announced to screen readers, and hiding a column moves focus to the header that takes its place.

Columns that can neither sort nor resize now get a menu button too. Set `pinnable: false` or `hideable: false` on a column to leave it out of those items, or turn them off with `headerMenu({ pin: false, hide: false })`.
