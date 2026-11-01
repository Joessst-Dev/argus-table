# Source layout

[← Back to contents](../README.md)

`core` holds logic with no Lit or DOM dependency; `table` holds the Lit controllers and templates that use it.

```text
packages/core/src/
├─ columns/      resolve-columns.ts (property or <argus-column> → ColumnDef[]) · auto-width.ts
├─ data/         data-source.ts (paging, debounce, abort) · row-cache.ts
├─ table/        create-table.ts (TanStack adapter; its types stay private)
├─ state/        controllable.ts (controlled / uncontrolled helper)
└─ index.ts

packages/table/src/
├─ argus-table.ts        the element: creates controllers, renders
├─ argus-column.ts       data-only element read by the column controller
├─ controllers/          column · data · table · virtual · interaction
├─ render/               header.ts · body.ts · pinned-rows.ts · skeleton.ts
├─ styles/               base.ts (@layer argus-base, default tokens)
└─ events.ts             event names + typed detail objects

packages/formulas/src/   (added in Phase 3)
├─ tokenizer.ts · parser.ts · validate.ts · graph.ts · compile.ts
├─ functions/            math.ts · logic.ts · text.ts · date.ts
└─ editor/               the formula editor element
```

Each controller gets its own test file next to it; `core` tests run in plain Vitest, `table` tests in Vitest browser mode.
