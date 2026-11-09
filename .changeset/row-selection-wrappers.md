---
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Row selection in the wrappers: the `selectionMode` and `selection` props, and the `argus-row-select` event as `onRowSelect` (React), `row-select` (Vue) and `rowSelect` (Angular). `selection` binds two-way like `sorting`: `selection` with `onRowSelect` in React, `v-model:selection` in Vue, `[(selection)]` in Angular. The `SelectionMode`, `SelectionState` and `RowSelectDetail` types are re-exported.
