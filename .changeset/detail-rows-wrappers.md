---
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Detail panels in the wrappers. React: `rowDetail` returns JSX. Vue: a `#detail` slot (it gets `{ row, rowId, index }`), or a `rowDetail` render function. Angular: `<ng-template argusDetail let-row>` (with `[argusDetailOf]` for typed rows; `ArgusDetailDirective` is in `ARGUS_TABLE`), or a `rowDetail` function returning `argusTemplate()`. `expanded` binds two-way: `onExpandedChange`, `v-model:expanded`, `[(expanded)]`. Panel content keeps its component state while it scrolls out of view and back.
