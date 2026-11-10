---
'@argus-table/angular': minor
---

Angular templates in cells and headers. Give a column its cells or header with a template inside the table:

```html
<argus-table [columns]="columns" [data]="orders()">
  <ng-template argusCell="status" [argusCellOf]="orders()" let-row let-value="value">
    <app-status-badge [status]="value" />
  </ng-template>
  <ng-template argusHeader="total">Total <app-info-tip /></ng-template>
</argus-table>
```

`[argusCellOf]` types `let-row` in strict templates, templates work with `<argus-column>` children too, and a `cell` function can return `argusTemplate(templateRef, context)`. The views keep your component's bindings and DI. Cells are pooled: as the table scrolls, a cell's view gets the next row's context instead of being re-created, so keep per-row state in your data. Import `ARGUS_TABLE` for the components and both directives.
