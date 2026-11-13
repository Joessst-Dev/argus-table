# @argus-table/vue

## 1.1.0

### Minor Changes

- 696a67b: New event `argus-column-resize-end`: it fires once when a user's resize is done, so you can save column widths without saving on every frame of a drag.

  ```js
  table.addEventListener('argus-column-resize-end', (event) => {
    localStorage.setItem('widths', JSON.stringify(event.detail.columnSizing));
  });
  ```

  - It fires when a drag on a column's or group's resize handle is released, after each Alt+Arrow press, and after a double-click on a handle or `autosizeColumns()` fits columns to their content. It comes after that resize's `argus-column-sizing-change` events.
  - `detail: { columnSizing, columnIds }`: the sizing after the resize and the columns it changed. When `columnSizing` is controlled, it's the last proposed sizing.
  - It doesn't fire when nothing changed (a column already at its `minWidth`, a press without moving), or when `columnSizing` or `setState()` set the widths.
  - The wrappers have it as `onColumnResizeEnd` (React), `@column-resize-end` (Vue) and `(columnResizeEnd)` (Angular), and export the `ColumnResizeEndDetail` type.

- 696a67b: The table components bind the formula editor's events from `formulas()` (`@argus-table/formulas`): `onFormulaColumnAdd`, `onFormulaColumnChange` and `onFormulaColumnRemove` in React, `@formula-column-add`, `@formula-column-change` and `@formula-column-remove` in Vue, and the `formulaColumnAdd`, `formulaColumnChange` and `formulaColumnRemove` outputs in Angular. Before, these needed a ref and `addEventListener`.

  ```tsx
  const apply = (e: CustomEvent<FormulaColumnDetail<Order>>) => setColumns(e.detail.columns);

  <ArgusTable
    columns={columns}
    data={orders}
    plugins={plugins}
    onFormulaColumnAdd={apply}
    onFormulaColumnChange={apply}
    onFormulaColumnRemove={apply}
  />;
  ```

  Each wrapper exports `FormulaColumnDetail<T>` and `FormulaColumnChangeDetail<T>`, typed with its own columns (`ReactColumnDef<T>`, `VueColumnDef<T>`, `AngularColumnDef<T>`), so `detail.columns` can go straight back into `columns`. The wrappers still don't depend on `@argus-table/formulas`.

- 806fc7d: The built-in text can be translated. Set `labels` on the table, and pass a `labels` option to `headerMenu()` and `formulas()`. Keys you leave out stay English.

  ```js
  table.labels = {
    selectRow: 'Zeile auswählen',
    rowCount: ({ count }) => (count === 1 ? '1 Zeile' : `${count} Zeilen`),
  };
  table.plugins = [
    formulas({ labels: { editFormula: 'Formel bearbeiten…' } }),
    headerMenu({ labels: { sortAscending: 'Aufsteigend sortieren' } }),
  ];
  ```

  - The table's labels cover the checkbox, resize handle and Retry button labels, the "No rows" text, the `aria-description` of filtered headers, and the announcements: the row count after filtering, and a column or group moved from the keyboard.
  - The column menu's labels cover its items, the filter form with its operators, and its announcements.
  - The formulas labels cover the menu items, the announcements and the editor. Function names, error codes, error messages and function descriptions stay English.
  - Text with values in it is a function of an object, such as `({ count }) => …`, so it can pick a plural form with `Intl.PluralRules`. Numbers are passed unformatted.
  - The types are `TableLabels` (also exported by the React, Vue and Angular wrappers, which get a `labels` prop), `HeaderMenuLabels` and `FormulasLabels`.

  The formula editor's preview of a single row now reads "Preview, first row" instead of "first 1 rows".

- 7397d32: Plugins can read the table's rows, values and group headers, as the new export add-on does:

  - `host.rowCount(section?)`, `host.rowId(index, section?)` and `host.value(index, columnId, section?)` read the body rows in the order shown (after sorting and filtering), or the rows pinned to the `'top'` or `'bottom'`. `value()` is what the column's `accessor` reads, hidden columns too. With a `dataSource`, rows that aren't loaded have no id or value.
  - `host.row(index, section?)` takes the section too.
  - `host.readValue(row, columnId, index)` applies a column's `accessor` to a row the plugin has itself, such as one it fetched from the `dataSource`.
  - `host.headerGroups()` lists the group header rows over the shown columns: each cell's group id (or none, over columns without a group) and its columns.
  - `ColumnInfo` (from `host.column()` and `host.columns()`) has the column's `align`.
  - New types: `RowSection` and `HeaderGroupInfo`, also exported by the React, Vue and Angular wrappers.

- 3a96001: Scroll to a row by id, choose where it lands, and scroll to a column.

  ```js
  await table.scrollToRow(500, { align: 'center' });
  await table.scrollToRow({ id: 'order-42' }, { align: 'nearest' });
  await table.scrollToColumn('total');
  ```

  - `scrollToRow()` takes an index in the current row order, as before, or `{ id }` with a `getRowId` id. Its new `align` option puts the row at the top of the view (`'start'`, the default, as before), at the bottom (`'end'`), in the middle (`'center'`), or scrolls only as far as needed to show it (`'nearest'`). The header and pinned rows are left out of the view, so the row never ends up behind them.
  - `scrollToColumn(id)` scrolls sideways so the column shows between the pinned columns: by default only as far as needed (`'nearest'`), or with `align: 'start' | 'center' | 'end'`. It works right to left, with flex columns and with `virtualizeColumns`.
  - Both resolve `true` once the table has re-rendered with the target in view, and `false` when there's nothing to scroll to: an unknown id, a row that's filtered out or not loaded, a hidden column. `scrollToRow()` used to resolve `undefined`.
  - With a `dataSource` that doesn't know its total yet, `scrollToRow()` to an index past the rows counted so far keeps scrolling toward it as pages arrive, as `setState()` does, until the user scrolls, clicks or presses a key.
  - New types: `ScrollAlign`, `ScrollToRowOptions`, `ScrollToColumnOptions` and `RowTarget`, also exported by the React, Vue and Angular wrappers. Their components expose `scrollToColumn()` too.

### Patch Changes

- 94353ae: The READMEs list every property, event and two-way binding: the wrappers' lists were missing `columnGroups`, `columnPinning`, `columnVisibility`, `columnFilters`, `quickFilter`, `labels` and the resize-end event, and `argus-table`'s status section still described a pre-1.0 release.
- Updated dependencies [696a67b]
- Updated dependencies [806fc7d]
- Updated dependencies [7397d32]
- Updated dependencies [94353ae]
- Updated dependencies [696a67b]
- Updated dependencies [3a96001]
  - argus-table@1.1.0

## 1.0.0

### Patch Changes

- Updated dependencies [d41bfcd]
  - argus-table@1.0.0

## 0.5.0

### Patch Changes

- Updated dependencies [29fdb31]
- Updated dependencies [22b625b]
  - argus-table@0.5.0

## 0.4.0

### Minor Changes

- 443f4be: Column group headers from templates: a `#group-<id>` slot on `ArgusTable` in Vue (it gets `{ groupId }`), and `<ng-template argusGroupHeader="<id>">` in Angular (`ArgusGroupHeaderDirective`, in `ARGUS_TABLE`). Both work for groups from `columnGroups` and from `ArgusColumnGroup` children.
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
