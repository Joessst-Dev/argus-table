# @argus-table/react

## 0.4.0

### Minor Changes

- bb8194e: Column groups: the table takes `columnGroups`, and `ArgusColumnGroup` (`ArgusColumnGroupComponent` in Angular, also in `ARGUS_TABLE`) wraps `ArgusColumn`s as `<argus-column-group>` does. A group's `header` can be framework content, typed as `ReactColumnGroup`, `VueColumnGroup` and `AngularColumnGroup`.
- 218350c: **Breaking:** the event props, emits and outputs follow the new `argus-<property>-change` event names, and their `detail` holds the value under the property's name (for example `e.detail.columnSizing`, previously `e.detail.sizing`).

  - **React:** the props are now `onSortingChange`, `onColumnSizingChange`, `onColumnOrderChange`, `onColumnPinningChange`, `onColumnVisibilityChange`, `onColumnFiltersChange` and `onSelectionChange`. They replace `onSortChange`, `onColumnResize`, `onColumnReorder`, `onColumnPin`, `onColumnHide`, `onColumnFilter` and `onRowSelect`.
  - **Vue:** the emits are now `sorting-change`, `column-sizing-change`, `column-order-change`, `column-pinning-change`, `column-visibility-change`, `column-filters-change` and `selection-change`. `v-model:…` works as before.
  - **Angular:**
    - Each state has one output, `sortingChange`, `columnSizingChange` and so on, which emits the new value, so `[(sorting)]` and the other two-way bindings work as before.
    - The outputs that emitted the whole event (`sortChange`, `columnResize`, `columnReorder`, `columnPin`, `columnHide`, `columnFilter` and `rowSelect`) are gone.
    - For the whole event, bind the element's own event, for example `(argus-column-sizing-change)="save($event.detail)"`.

### Patch Changes

- 333ad32: Follow the 1.0 plugin API (ADR 0004).

  - **Formulas:**
    - Exports `FORMULA_COLUMN_ADD`, `FORMULA_COLUMN_CHANGE` and `FORMULA_COLUMN_REMOVE` for its event names, and `FormulaMenuGroup` and `FormulaMenuItem` for its menu items.
    - `FormulaColumnDetail` and `FormulaColumnChangeDetail` take the columns' content type as a second parameter, which defaults to the table's own. `detail.columns` is a readonly array.
  - **Wrappers:** they re-export the new `SortDirection` type, and a check keeps their type re-exports in step with `argus-table`.

- Updated dependencies [6edb3cd]
- Updated dependencies [333ad32]
- Updated dependencies [443f4be]
- Updated dependencies [bb8194e]
- Updated dependencies [ed14d91]
- Updated dependencies [218350c]
- Updated dependencies [08c5fcf]
  - argus-table@0.4.0

## 0.3.0

### Minor Changes

- 1d1a6f0: `rowHeight` accepts `'auto'`, to fit each row to its content. In Angular templates, `rowHeight="48px"` typechecks too.
- d052e1d: `columnFilters` binds two-way like `columnPinning`: `v-model:column-filters` in Vue, `[(columnFilters)]` in Angular, and `onColumnFilter` in React. `quickFilter` is a plain prop. `<ArgusColumn>` takes `filter`, `filterFn` and `filterOptions`, and the filter types (`ColumnFilter`, `ColumnFilterState`, …) are exported.
- 090fcba: `ArgusColumn` takes a `formula` prop (an input in Angular) for the `@argus-table/formulas` plugin.
- 9a28979: The `columnPinning` and `columnVisibility` props bind two-way like `columnOrder`: `v-model:column-pinning` and `v-model:column-visibility` in Vue, `[(columnPinning)]` and `[(columnVisibility)]` in Angular, and `onColumnPin` / `onColumnHide` in React. `<ArgusColumn>` takes `pinnable` and `hideable`.
- e611a9e: The `virtualizeColumns` prop (`virtualize-columns` in Vue and Angular templates) turns on the table's column virtualization for wide tables.
- b48284b: `ArgusColumn` takes `wrap`, to wrap a column's cell text onto more lines.
- 55b84a3: JSX in cells and headers: a column's `cell` and `header` (in `columns` or on `<ArgusColumn>`) can return any React node.

  ```tsx
  const columns: ReactColumnDef<Order>[] = [
    { id: 'status', header: <b>Status</b>, cell: (o) => <StatusBadge status={o.status} /> },
  ];
  ```

  The content renders through portals in your component tree, so it sees your providers (theme, router, store). Cells are pooled: as the table scrolls, a cell's component gets the next row's props instead of remounting, so keep per-row state in your data. `react-dom` is now a peer dependency.

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

- 0f5a5a6: New package: `@argus-table/react`, React components for `<argus-table>` and `<argus-column>`.

  ```tsx
  import { ArgusTable } from '@argus-table/react';

  <ArgusTable
    aria-label="Orders"
    columns={columns}
    data={orders}
    sorting={sorting}
    onSortChange={(e) => setSorting(e.detail.sorting)}
    onRowClick={(e) => open(e.detail.row)}
  />;
  ```

  - Props set the element's properties. Each event is an `on*` prop (`onSortChange`, `onColumnResize`, `onColumnReorder`, `onCellClick`, `onRowClick`, `onRangeChange`, `onLoadError`) that gets the element's `CustomEvent`, with its detail typed.
  - The row type is inferred from `data`, or given as `<ArgusTable<Order>>`, so `e.detail.row` in `onRowClick` is an `Order`.
  - `sorting`, `columnSizing` and `columnOrder` are controlled when you pass them and uncontrolled when you leave them out.
  - A `ref` gives the element, for `refresh()`, `scrollToRow()` and `autosizeColumns()`.
  - `<ArgusColumn>` writes columns as children, so they can come from a `.map()`.
  - Works in React 18.3 and 19, and in Server Components apps (the modules are marked `'use client'`).

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
