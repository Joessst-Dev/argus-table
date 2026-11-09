# @argus-table/vue

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

- 3ef9b41: New package: `@argus-table/vue`, Vue components for `<argus-table>` and `<argus-column>`.

  ```vue
  <ArgusTable
    v-model:sorting="sorting"
    aria-label="Orders"
    :columns="columns"
    :data="orders"
    @row-click="(e) => open(e.detail.row)"
  />
  ```

  - Props set the element's properties. Each event is emitted without its `argus-` prefix (`sort-change`, `column-resize`, `column-reorder`, `cell-click`, `row-click`, `range-change`, `load-error`) with the element's `CustomEvent`, its detail typed.
  - `v-model:sorting`, `v-model:column-sizing` and `v-model:column-order`. Unbound, the table keeps that state itself; a one-way binding is controlled.
  - The row type is inferred from `data`, so vue-tsc checks `e.detail.row` in your templates. In render functions, give it: `h(ArgusTable<Order>, …)`.
  - A template ref gives `refresh()`, `scrollToRow()`, `autosizeColumns()` and the `element`.
  - `<ArgusColumn>` writes columns as children, so they can come from a `v-for`. Boolean attributes work as in HTML: `<ArgusColumn sortable>`.
  - Vue 3.5 or newer.

### Patch Changes

- 4d71e74: Event handlers only get the table's own events. The table's events bubble, so a table nested in a cell of another table also triggered the outer table's `onRowClick`, `@row-click` and so on, and `v-model` on the outer table took the inner table's sort order. Listen on the inner table for its events.
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
