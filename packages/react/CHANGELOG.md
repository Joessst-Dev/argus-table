# @argus-table/react

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
