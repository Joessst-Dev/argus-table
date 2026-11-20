---
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Row grouping in the wrappers: `grouping` binds two-way, and a column's cells on group rows can be framework content: React `groupCell` returning JSX, Vue `#row-group-<column id>` slots, Angular `<ng-template argusGroupCell="<column id>">` (`ArgusGroupCellDirective`, in `ARGUS_TABLE`).
