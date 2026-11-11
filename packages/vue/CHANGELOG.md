# @argus-table/vue

## 0.3.0

### Minor Changes

- 1d1a6f0: `rowHeight` accepts `'auto'`, to fit each row to its content. In Angular templates, `rowHeight="48px"` typechecks too.
- d052e1d: `columnFilters` binds two-way like `columnPinning`: `v-model:column-filters` in Vue, `[(columnFilters)]` in Angular, and `onColumnFilter` in React. `quickFilter` is a plain prop. `<ArgusColumn>` takes `filter`, `filterFn` and `filterOptions`, and the filter types (`ColumnFilter`, `ColumnFilterState`, …) are exported.
- 090fcba: `ArgusColumn` takes a `formula` prop (an input in Angular) for the `@argus-table/formulas` plugin.
- 9a28979: The `columnPinning` and `columnVisibility` props bind two-way like `columnOrder`: `v-model:column-pinning` and `v-model:column-visibility` in Vue, `[(columnPinning)]` and `[(columnVisibility)]` in Angular, and `onColumnPin` / `onColumnHide` in React. `<ArgusColumn>` takes `pinnable` and `hideable`.
- e611a9e: The `virtualizeColumns` prop (`virtualize-columns` in Vue and Angular templates) turns on the table's column virtualization for wide tables.
- b48284b: `ArgusColumn` takes `wrap`, to wrap a column's cell text onto more lines.
- c073945: Vue content in cells and headers. Give a column its cells or header with a slot named after its id, or return VNodes from `cell` and `header`:

  ```vue
  <ArgusTable :columns="columns" :data="orders">
    <template #cell-status="{ row, value }"><StatusBadge :status="value" /></template>
    <template #header-total>Total <InfoTip /></template>
  </ArgusTable>
  ```

  Slots get the row and its context, typed from `data`, and work with `<ArgusColumn>` children too. Cells see your app's and the table's ancestors' injections, and follow the state they read. Cells are pooled: as the table scrolls, a cell's components get the next row's props instead of remounting, so keep per-row state in your data.

- fc539da: The `plugins` prop passes add-ons to the table, such as `headerMenu()` from `@argus-table/header-menu`. Keep the array stable between renders (a constant, `useMemo` in React, a non-reactive value in Vue, a field in Angular): a new plugin instance reconnects and closes an open menu. The `ArgusPlugin`, `PluginHost`, `CellTarget` and `ColumnInfo` types are re-exported.
- 5c08bb1: Row selection in the wrappers: the `selectionMode` and `selection` props, and the `argus-row-select` event as `onRowSelect` (React), `row-select` (Vue) and `rowSelect` (Angular). `selection` binds two-way like `sorting`: `selection` with `onRowSelect` in React, `v-model:selection` in Vue, `[(selection)]` in Angular. The `SelectionMode`, `SelectionState` and `RowSelectDetail` types are re-exported.
- cfbc794: `getState()` and `setState(state)` are available on the React ref, the Vue template ref and the Angular component, to save and restore a user's layout. The `TableState` and `ScrollState` types are exported.
- a691e9d: The `selectionCheckboxes` prop (`selection-checkboxes` in Vue and Angular templates) adds the table's checkbox column.

### Patch Changes

- Updated dependencies [1d1a6f0]
- Updated dependencies [d052e1d]
- Updated dependencies [090fcba]
- Updated dependencies [9a28979]
- Updated dependencies [282b5eb]
- Updated dependencies [e611a9e]
- Updated dependencies [b48284b]
- Updated dependencies [ad09697]
- Updated dependencies [55b84a3]
- Updated dependencies [d1716be]
- Updated dependencies [fc539da]
- Updated dependencies [5c08bb1]
- Updated dependencies [cfbc794]
- Updated dependencies [a691e9d]
  - argus-table@0.3.0

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
