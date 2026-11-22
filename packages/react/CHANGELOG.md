# @argus-table/react

## 1.4.0

### Minor Changes

- cae43e9: Detail panels in the wrappers. React: `rowDetail` returns JSX. Vue: a `#detail` slot (it gets `{ row, rowId, index }`), or a `rowDetail` render function. Angular: `<ng-template argusDetail let-row>` (with `[argusDetailOf]` for typed rows; `ArgusDetailDirective` is in `ARGUS_TABLE`), or a `rowDetail` function returning `argusTemplate()`. `expanded` binds two-way: `onExpandedChange`, `v-model:expanded`, `[(expanded)]`. Panel content keeps its component state while it scrolls out of view and back.
- 6d8f676: Row grouping in the wrappers: `grouping` binds two-way, and a column's cells on group rows can be framework content: React `groupCell` returning JSX, Vue `#row-group-<column id>` slots, Angular `<ng-template argusGroupCell="<column id>">` (`ArgusGroupCellDirective`, in `ARGUS_TABLE`).
- 8523ab5: `stretchColumns` (attribute `stretch-columns`) makes the columns fill the table's width: when they're narrower than the table, they stretch in proportion to their widths, up to their `maxWidth`; when the table gets narrower, they shrink back to their own widths and the table scrolls sideways as usual. A column you resize keeps the width you give it, and the other columns share the space it frees; once every column has been resized, the last one takes the free space. Pinned columns and the checkbox and chevron columns keep their widths, and nothing stretches while a `{ flex }` column takes the space. `columnSizing`, `getState()` and the resize events hold each column's own width, never a stretched one, so a saved layout fits any width. Off by default.
- 7cbe470: Tree rows from a `dataSource`: a row's children can load from the server when it's expanded. Give the data source `hasChildren(row)`, which says whether a row has children (it gets a toggle), and `getChildren({ parent, parentId, sorting, filters, quickFilter, signal })`, which resolves to `{ rows }` with all of the row's children, sorted and filtered like the rows. Both are needed; with only one the rows stay flat. `getRows` keeps returning the top-level rows (its `start`, `end` and `total` count those), and children can have children of their own, loaded the same way. Everything else works as for tree rows held in memory: `treeExpanded` and its event, the toggle, the keys, the treegrid ARIA, `depth` in cell functions and click events, and `scrollToRow()`, the click events and `argus-range-change` counting the rows shown.

  Expanding a row calls `getChildren` once; until it answers, a loading row shows under the row. Children stay loaded when the row collapses. A new source, sort, filters, quick filter or `getRowId`, or `refresh()`, drops them (requests in flight are aborted through `signal`) and the expanded rows load theirs again; after a sort or `refresh()`, each shows as many loading rows as it showed rows under it, so the rows below don't jump. A `treeExpanded` restored with `setState()` opens rows as their pages load. Children that come back empty remove the row's toggle. Without `getRowId`, a child's id is its parent's id, a dot and its index among its siblings (`'3.0'`); with it, `getRowId` gets that index. The server filters at every level, so with a `dataSource` a filter opens no rows by itself.

  When `getChildren` rejects, a row with a Retry button shows under the row (its accessible name is the new `retryChildren` label, "Retry loading child rows") and `argus-load-error` fires with the row's id as the new `parentId`, `start` its index among the rows shown (`-1` while a collapsed ancestor hides it) and `end` the next one. Retry, or expanding the row again, asks again. With tree rows, a failed page's `start` and `end` count the rows shown too.

  With `selectBranches`, ticking a row selects the loaded rows under it, and children that load under a ticked row join the selection (with an `argus-selection-change`). While a filter or the quick filter is on, a row's own id isn't selected, since the server may not have sent all of its children, and a row whose children haven't loaded can't be ticked until they do.

  The wrappers export the `ChildrenRequest` and `ChildrenResponse` types.

- c2a7b25: Tree rows: rows can have child rows, such as a folder and its files or a manager and their team. Give the table `getSubRows`, which returns a row's children (`data` then holds the top-level rows), or, for flat data where each row names its parent, `getParentId`. A row with children gets a toggle in the first data column, and each level is indented under its parent. Child rows are rows like any other: they have cells in every column, and they sort among their siblings, filter, select, fire click events, open detail panels and scroll into view. A filter or the quick filter keeps the rows that match with their ancestors, so a match always shows in its place: those ancestors show expanded, with their toggles disabled until the filter clears.

  `treeExpanded` (row ids, in `getState()` too) says which rows are expanded: uncontrolled until set, with `argus-tree-expanded-change` (`{ treeExpanded, rowId, open }`) for each change. Without `getRowId`, a child's id is its parent's id, a dot and its index among its siblings (`'3.0'`); top-level rows keep their index in `data`. `getRowId` and a column's `accessor` get a nested child's index counted from `data.length` on. Every other index (`scrollToRow`, click events, `argus-range-change`) counts the rows shown, so expanding a row moves the indexes below it. Cell functions, `rowDetail`, `argus-cell-click` and `argus-row-click` get the row's level as `depth`, set only when the rows form a tree. Plugins get `host.rowDepth()` and `host.sourceRow()`.

  From the keyboard, on a cell of the first data column, ArrowRight expands a collapsed row and ArrowLeft collapses an expanded one or goes to the parent row (mirrored in right-to-left tables); Enter keeps its meaning. The table becomes a WAI-ARIA `treegrid`, and rows carry their level, whether they're expanded and their place among their siblings, for screen readers.

  `selectBranches` (attribute `select-branches`, in `selectionMode: 'multi'`) selects whole branches: ticking a row selects it and every row under it that the filters keep, a row's id is in `selection` only while its whole branch is (rows a filter hides included, so under a filter a parent with unselected hidden children stays out and shows part-ticked), and a row with part of its branch selected shows a part-ticked checkbox. A row a filter keeps while hiding all its children has nothing to tick: its checkbox is disabled (`::part(selection-checkbox):disabled` styles it). Select-all then covers every row the filters keep, collapsed or not.

  Styling: the toggle is the `tree-toggle` part (with `tree-toggle-disabled` while a filter keeps its row open), and `--argus-tree-indent` (1.25rem) sets the indent per level. New labels: `expandTreeRow`, `collapseTreeRow`. With a `dataSource`, `getSubRows` and `getParentId` are ignored (with a console warning): its `hasChildren` and `getChildren` load children instead.

  In the wrappers, `treeExpanded` binds two-way (`onTreeExpandedChange`, `v-model:tree-expanded`, `[(treeExpanded)]`), Angular cell and detail templates get `depth`, and `TreeExpandedState` and `TreeExpandedChangeDetail` are exported.

### Patch Changes

- Updated dependencies [8b2eae8]
- Updated dependencies [cae43e9]
- Updated dependencies [2579957]
- Updated dependencies [24e1c42]
- Updated dependencies [e221ebc]
- Updated dependencies [471c332]
- Updated dependencies [6c95cdc]
- Updated dependencies [8379a67]
- Updated dependencies [013cd4b]
- Updated dependencies [ae76b1f]
- Updated dependencies [6d8f676]
- Updated dependencies [1c85328]
- Updated dependencies [97b07e5]
- Updated dependencies [c2a7b25]
- Updated dependencies [de99bdf]
- Updated dependencies [b99de54]
- Updated dependencies [9b43ccd]
- Updated dependencies [2e5bf03]
- Updated dependencies [8714311]
- Updated dependencies [8e8cec0]
- Updated dependencies [8523ab5]
- Updated dependencies [7cbe470]
- Updated dependencies [c2a7b25]
- Updated dependencies [5f230e2]
  - argus-table@1.4.0

## 1.3.0

### Minor Changes

- 526251a: The table components bind `argus-cell-edit` from `@argus-table/editing`: `onCellEdit` in React, `@cell-edit` in Vue and `(cellEdit)` in Angular, typed with the exported `CellEditDetail<T>`.

### Patch Changes

- Updated dependencies [39d2808]
- Updated dependencies [afb3792]
- Updated dependencies [71eb419]
- Updated dependencies [077fbf6]
- Updated dependencies [9350927]
  - argus-table@1.3.0

## 1.2.0

### Minor Changes

- 3cdbe9c: Headers that are templates, JSX or VNodes can now give their column a plain-text name, and columns get a `meta` field for plugins' and your own settings.

  ```js
  const columns = [
    {
      id: 'total',
      // `text` is true when the table or a plugin asks for the name as plain text.
      header: ({ text }) => (text ? 'Total' : html`<b>Total</b> <small>EUR</small>`),
      accessor: 'total',
      meta: { export: { header: 'Total (EUR)' } },
    },
  ];
  ```

  - A `header` function gets a context: `{ columnId, text }` for a column, `{ groupId, text }` for a column group (types `HeaderContext` and `GroupHeaderContext`). The table renders it with `text: false`. With `text: true` it returns the name as plain text, which the column menu, exports and the table's announcements use. A header with no text is named by its column id, as before. Headers that ignore the context keep working.
  - When a column moves from the keyboard (Alt+Shift+Arrow), the announcement names it by that text first, then by the header's visible text.
  - `meta` holds fields for plugins and the app. The table doesn't read it; plugins get it as `host.column(id).meta`. Type your own fields by augmenting `ColumnMeta`: `declare module 'argus-table' { interface ColumnMeta<TData> { … } }`. With only a framework wrapper installed, augment `'@argus-table/react'`, `'@argus-table/vue'` or `'@argus-table/angular'` instead. `<argus-column>` takes `meta` as a property.
  - For plugins: `host.headerText(def)` returns a column's or group's name (`undefined` when its header has none), and `ColumnInfo.meta` is the column's `meta`. A plugin that wraps headers in its own function should forward text mode: `(context) => (context.text ? host.headerText(def) : …)`.
  - The wrappers type `header` with the context, and export `ColumnMeta`, `HeaderContext` and `GroupHeaderContext`. A Vue `#header-<id>` or `#group-<id>` slot, or an Angular `argusHeader` or `argusGroupHeader` template, names its column or group by the `header` in its definition.
  - If your own code calls a column's `header()` directly, it now has to pass a context, for example `{ columnId: def.id, text: false }`.

### Patch Changes

- Updated dependencies [3cdbe9c]
  - argus-table@1.2.0

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
