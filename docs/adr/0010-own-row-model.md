# ADR 0010: Own row model, without TanStack Table

- **Status:** Accepted (17 November 2026).
- **Builds on:** [ADR 0008](0008-own-row-virtualization.md), which left this as "a separate decision if it comes".

## Context

Core wraps `@tanstack/table-core` in `table/create-table.ts` and never exposes its types. Over 0.2 to 1.3, core took over most of what TanStack did:

- **Sorting:** core's own sorted row model (`table/sorted-row-model.ts`) reads each value once and sorts row positions. TanStack's `createSortedRowModel()` took minutes in Firefox at 1M rows. Core still uses TanStack's four sort functions and its `auto` pick.
- **Filtering:** core's own filtered row model and `rowPredicate`, registered in TanStack's slot with a cast. Values are read through core's resolved accessors, not `row.getValue()`.
- **Pinning, visibility and order:** core's own (`buildViews`, `columns/column-order.ts`). TanStack has none of those features installed.
- **Remote rows** (`dataSource`) bypass TanStack's row models already.

What TanStack still does:

- **The core row model:** a `Row` object for every data row (`id`, `index`, `original`, `depth`, `parentId`, `subRows`, three caches), a `rowsById` record and a `flatRows` array.
- **Column sizing:** `getSize()`, a width clamped to the column's minimum and maximum.
- **Sort functions:** `alphanumeric`, `text`, `datetime`, `basic`, and picking one from the first value (`auto`).
- **Value caching** per row and column (`_valuesCache`), which core has to clear by hand when a column keeps its id but gets a new accessor.

The row objects are now the table's biggest cost at scale:

| Measured                                                       | 100k rows | 1M rows  |
| -------------------------------------------------------------- | --------- | -------- |
| Table heap in Chromium (benchmarks, 1.3.0)                     | 31.6 MB   | 297.1 MB |
| TanStack's core row model alone, Node (no pointer compression) | 55 MB     | 551 MB   |
| Building TanStack's core row model, Node                       | –         | 404 ms   |
| Page load in Chromium (benchmarks, 1.3.0)                      | 99 ms     | 1,407 ms |

The core row model alone is about 551 B per row in Node and about 280 B in Chromium, which compresses pointers: nearly all of the table's 297 MB at 1M rows. Chromium's only frames over 50 ms in the 1.3.0 benchmarks are at 1M rows (long tasks of 84–138 ms in the steady, jumps and horizontal scenarios), which points at garbage collection over that heap. The benchmark below saw none of them with this change.

Bundle size: by the CDN build's source map, `@tanstack/table-core` and `@tanstack/store` are about 8.4 kB of 50.91 kB gzipped, the biggest share after `argus-table.ts`. Dependency updates since ADR 0008 took the build from 50.31 to 50.91 kB, so the 51 kB budget has 90 B left. Any feature that adds runtime code needs a raise.

The features planned next (expandable detail rows, tree data, row grouping) need rows the table shows that aren't data rows. TanStack's row model has sub-rows and grouping as features, at more bundle size, and core would have to work around its `Row` objects again, as it did for sorting and filtering.

## Decision

- **Core owns the row model.** Body rows are data indexes: an `Int32Array` (or `number[]`) of positions into `data`, in the current order, with a new identity for each new order (`rowOrder`, as today). No object per row. Ids come from `getRowId` when asked for; `indexOf(id)` keeps its lazy map.
- **`RowView`s are made for the rows read** (rendered rows, plugins' `row()`), cached by data index for the current order, as the `WeakMap` per `Row` does now.
- **Values aren't cached per row.** Sorting and filtering read each value once per pass already. Rendering reads the visible cells only. The cache-clearing in `update()` for changed accessors goes away. The model still bumps `valueVersion` when an accessor changes, so sorting and filtering run again.
- **Sizing is core's own:** a column's width is its resized width, auto width or definition width, clamped to its minimum and maximum, as `getSize()` does.
- **The four sort functions and the `auto` pick move into core.** The code is ported from TanStack Table (MIT), with the same results, so sort orders don't change. Core's sort tests run against both before TanStack is removed.
- **`@tanstack/table-core` leaves `argus-table`'s dependencies.** `argus-table` then depends on `lit` only.
- **No public API changes.** TanStack's types were never public (`types.ts` holds core's own), and every property, event, method and plugin host member stays as it is.

## Options not taken

- **Keeping TanStack for the core row model and making it lighter.** Its `Row` objects and `rowsById` are what `createCoreRowModel()` builds; there's no option for fewer fields, and a custom core row model would be core's own row model behind TanStack's types.
- **Using TanStack's expanding and grouping features for the next features.** They'd add bundle size the budget doesn't have. Their rows would come through `getRowModel()`, which core already replaces at every step after the core row model.
- **Waiting for TanStack Table v9 to be stable.** The cost is in the data structure, not in API churn.

## Evidence

- **Bundle:** `argus-table`'s CDN build 50.91 → 41.23 kB gzipped (`pnpm size`); the budget goes from 51 to 42 kB.
- **Same results as before:** a throwaway parity test built the old (TanStack) model and the new one side by side on 40 seeded data sets of 67–340 rows, 12 configurations each (one to three sort columns in either direction over text, text with digits, numbers with `NaN`, `Infinity` and `undefined`, dates, mixed types, long digit runs; with and without `getRowId`, the quick filter, a number filter, resized and measured widths and a pinned flex column), and compared the row order, column widths and offsets, `selectableIds()`, `cellContext()`, `indexOf()` and `indexesPassing()`: all 480 matched. Changing the sort pick in the new model (`alphanumeric` → `text`) made it fail. `sort-fns.test.ts` keeps the sort functions' cases.
- **Tests:** core 277, `argus-table` 403 in Chromium and 804 in Firefox and WebKit, every other project's unit tests, e2e in all three engines (264 passed). Six core tests changed: five compared `rowAt()` objects by identity to mean "the row model was kept" and now compare `rowOrder`; one counted accessor reads to show a new `columns` array doesn't re-read values, which relied on TanStack's value cache, and now checks that it doesn't sort again. One formulas test counted the reads of a plain column the table also renders; the column is now hidden, so the count is the formula's alone.
- **Benchmark:** `pnpm bench` with `ROWS=100000,1000000 BROWSERS=chromium,firefox RUNS=3`, `main` and this change back to back on the same machine (Linux, headless; medians of three runs):

  | Rows | Browser  | Table heap MB | Load ms  | Sort ms   |
  | ---- | -------- | ------------- | -------- | --------- |
  | 100k | Chromium | 31.6 → 1.8    | 73 → 27  | 51 → 44   |
  | 1M   | Chromium | 297.2 → 5.4   | 805 → 27 | 651 → 407 |
  | 100k | Firefox  | n/a           | 81 → 19  | 69 → 62   |
  | 1M   | Firefox  | n/a           | 735 → 23 | 823 → 520 |

  Every scroll scenario passes the gate in both, with p50 16.7 ms and p95 16.7–17.4 ms either way. `main` had frames over 50 ms at 1M rows (two in Chromium's jumps, up to 133 ms; four in Firefox's fast scroll, up to 83 ms), this change none; with three runs that is a hint, not a result. The last row is reached at 1M rows in both engines.

## Consequences

- The README and `package.json` say "built with Lit and TanStack": they become "built with Lit". `docs/plan/` and `CLAUDE.md` describe TanStack as the internal adapter; they change with it.
- The open question "Expose TanStack's table instance as an escape hatch?" ([Risks](../plan/plan/13-risks-and-open-questions.md)) is closed: there's no instance to expose.
- Expandable rows, tree data and grouping build on core's row model: a list of shown rows that can include rows that aren't data rows.
- Sort-order fixes no longer come from TanStack releases. The ported sort functions are small and covered by tests.
