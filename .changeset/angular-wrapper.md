---
'@argus-table/angular': minor
---

New package: `@argus-table/angular`, standalone components on the `<argus-table>` and `<argus-column>` tags.

```html
<argus-table
  aria-label="Orders"
  [columns]="columns"
  [data]="orders()"
  [(sorting)]="sorting"
  (rowClick)="open($event.detail.row)"
/>
```

- Import `ArgusTableComponent` (and `ArgusColumnComponent`) and write the tags as usual. No `CUSTOM_ELEMENTS_SCHEMA` needed.
- Inputs set the element's properties; `null`, as from the `async` pipe, means unset. Each event is an output without its `argus-` prefix (`sortChange`, `columnResize`, `columnReorder`, `cellClick`, `rowClick`, `rangeChange`, `loadError`), with the element's `CustomEvent`, its detail typed.
- `[(sorting)]`, `[(columnSizing)]` and `[(columnOrder)]`. Unbound, the table keeps that state itself; a one-way binding is controlled.
- The row type is inferred from `[data]`, so strict templates check `$event.detail.row`.
- Attributes on `<argus-column>` work as in HTML: `width="90"`, `sortable`, `resizable="false"`.
- A view query gives `refresh()`, `scrollToRow()`, `autosizeColumns()` and the `element`.
- Events of a table nested in a cell don't reach the outer table's outputs.
- Angular 20, 21 and 22.
