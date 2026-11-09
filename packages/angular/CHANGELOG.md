# @argus-table/angular

## 0.2.2

### Patch Changes

- Updated dependencies [8cd61c8]
  - argus-table@0.2.2

## 0.2.1

### Patch Changes

- ce83244: The wrappers depend on `argus-table` with a caret range (`^0.2.0`) instead of an exact version, so a newer `argus-table` you install yourself is shared with the wrapper rather than installed twice. Two copies would both try to register `<argus-table>`, and the second fails.
- Updated dependencies [fe9949e]
  - argus-table@0.2.1

## 0.2.0

### Minor Changes

- 9c6257e: New package: `@argus-table/angular`, standalone components on the `<argus-table>` and `<argus-column>` tags.

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

### Patch Changes

- Updated dependencies [b9b0b2e]
- Updated dependencies [8f008b3]
- Updated dependencies [2b954bf]
- Updated dependencies [eebb8a1]
- Updated dependencies [d86671c]
- Updated dependencies [a5aa931]
- Updated dependencies [8550539]
- Updated dependencies [aa1a40b]
- Updated dependencies [6b33bbc]
- Updated dependencies [19012fe]
- Updated dependencies [0f5a5a6]
  - argus-table@0.2.0
