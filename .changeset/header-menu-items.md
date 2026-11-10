---
'@argus-table/header-menu': minor
---

Other plugins can add items to the column menu: a plugin in `plugins` with a `headerMenuItems(columnId, host)` method returns groups of items (`label`, an optional dimmed `detail`, `danger`, `run()`), shown after the built-in ones with separators and optional headings. A column with items gets a menu button even when it can't sort or resize. The `HeaderMenuContributor`, `HeaderMenuGroup` and `HeaderMenuItem` types are exported, and `--argus-menu-danger-fg` and `--argus-menu-detail-font` style the new parts.
