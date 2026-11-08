---
'@argus-table/react': minor
---

New package: `@argus-table/react`, React components for `<argus-table>` and `<argus-column>`.

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
