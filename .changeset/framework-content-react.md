---
'@argus-table/react': minor
---

JSX in cells and headers: a column's `cell` and `header` (in `columns` or on `<ArgusColumn>`) can return any React node.

```tsx
const columns: ReactColumnDef<Order>[] = [
  { id: 'status', header: <b>Status</b>, cell: (o) => <StatusBadge status={o.status} /> },
];
```

The content renders through portals in your component tree, so it sees your providers (theme, router, store). Cells are pooled: as the table scrolls, a cell's component gets the next row's props instead of remounting, so keep per-row state in your data. `react-dom` is now a peer dependency.
