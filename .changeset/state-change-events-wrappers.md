---
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

**Breaking:** the event props, emits and outputs follow the new `argus-<property>-change` event names, and their `detail` holds the value under the property's name (for example `e.detail.columnSizing`, previously `e.detail.sizing`).

- **React:** the props are now `onSortingChange`, `onColumnSizingChange`, `onColumnOrderChange`, `onColumnPinningChange`, `onColumnVisibilityChange`, `onColumnFiltersChange` and `onSelectionChange`. They replace `onSortChange`, `onColumnResize`, `onColumnReorder`, `onColumnPin`, `onColumnHide`, `onColumnFilter` and `onRowSelect`.
- **Vue:** the emits are now `sorting-change`, `column-sizing-change`, `column-order-change`, `column-pinning-change`, `column-visibility-change`, `column-filters-change` and `selection-change`. `v-model:…` works as before.
- **Angular:**
  - Each state has one output, `sortingChange`, `columnSizingChange` and so on, which emits the new value, so `[(sorting)]` and the other two-way bindings work as before.
  - The outputs that emitted the whole event (`sortChange`, `columnResize`, `columnReorder`, `columnPin`, `columnHide`, `columnFilter` and `rowSelect`) are gone.
  - For the whole event, bind the element's own event, for example `(argus-column-sizing-change)="save($event.detail)"`.
