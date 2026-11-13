---
'@argus-table/header-menu': minor
---

`headerMenu()` takes `sort` and `fitWidth` options, like `pin`, `hide` and `filter`: `headerMenu({ sort: false })` leaves out Sort ascending, Sort descending and Unsorted, and `headerMenu({ fitWidth: false })` leaves out Fit width. Both default to `true`.

A column gets a menu button only if something is left in its menu, so with every option off only columns with items from other plugins (such as formulas) get one. A click on a header still sorts without the sort items; turn that off per column with `sortable: false`.
