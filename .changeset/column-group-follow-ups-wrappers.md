---
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Column group headers from templates: a `#group-<id>` slot on `ArgusTable` in Vue (it gets `{ groupId }`), and `<ng-template argusGroupHeader="<id>">` in Angular (`ArgusGroupHeaderDirective`, in `ARGUS_TABLE`). Both work for groups from `columnGroups` and from `ArgusColumnGroup` children.
