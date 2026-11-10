---
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

The `plugins` prop passes add-ons to the table, such as `headerMenu()` from `@argus-table/header-menu`. Keep the array stable between renders (a constant, `useMemo` in React, a non-reactive value in Vue, a field in Angular): a new plugin instance reconnects and closes an open menu. The `ArgusPlugin`, `PluginHost`, `CellTarget` and `ColumnInfo` types are re-exported.
