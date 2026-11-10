# Source layout

[← Back to contents](../README.md)

`core` holds logic with no Lit or DOM dependency; `table` holds the Lit controllers and templates that use it.

```text
packages/core/src/
├─ columns/      resolve-columns.ts (property or <argus-column> → ColumnDef[]) · auto-width.ts
├─ data/         page-cache.ts (dataSource pages: loaded, in flight, failed; row count; eviction)
├─ table/        create-table.ts (TanStack adapter; its types stay private)
├─ types.ts      public types (ColumnDef, SortState, event details), re-exported by argus-table
├─ state/        controllable.ts (controlled / uncontrolled helper)
├─ virtual/      row-pool.ts (pool slots for rendered rows, ADR 0001)
└─ index.ts

packages/table/src/
├─ argus-table.ts        the element: creates controllers, renders
├─ argus-column.ts       data-only element; tells its parent table when it changes
├─ controllers/          column-children (<argus-column> children → ColumnDef[]) · data (dataSource loading: debounce, abort) · table · virtual · interaction
├─ render/               header.ts · body.ts · pinned-rows.ts · skeleton.ts (rows and slotted content rendered in pool order, ADR 0001)
├─ styles/               base.ts (@layer argus-base, default tokens)
└─ events.ts             event names + typed detail objects

packages/formulas/src/   (added in Phase 3)
├─ plugin.ts             formulas(): resolves names, compiles in dependency order, caches results per row
├─ styles.ts             @layer argus-formulas (ƒx mark, error values)
├─ engine/               DOM-free, tested in Node: tokenize.ts · parse.ts · coerce.ts · compile.ts · infer.ts · graph.ts · errors.ts
│  └─ functions/         math.ts · logic.ts · text.ts · date.ts
└─ editor/               the formula editor element (planned)
```

Each controller gets its own test file next to it; `core` tests run in plain Vitest, `table` tests in Vitest browser mode.
