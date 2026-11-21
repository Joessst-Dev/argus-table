# Row grouping, PR 4 (grouped export) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@argus-table/export` writes a grouped table's group rows (value, count, totals) with its rows: Excel as outline rows, PDF as shaded bold rows indented per level, CSV as plain rows.

**Architecture:** The plugin host's `groupedRows()` (unreleased since #200, so its shape can change) lists group rows too, in the grouped order with every group open. `collect.ts` builds an `ExportSheet` whose new `outline` gives each row its depth and whether it is a group row; the three writers lay that out. Detail rows stay one level below their row.

**Tech Stack:** TypeScript, Vitest (Node for the writers, browser for the plugin), Nx.

**Spec:** `docs/superpowers/specs/2026-11-20-row-grouping-design.md` ("Export"). PRs #200–#202 are merged; read ADR 0014 and CLAUDE.md's `packages/export` and Row grouping paragraphs first.

## Global Constraints

- `argus-table` 1.4 isn't released: `PluginHost.groupedRows()` may change shape. Everything else: additions only (ADR 0004).
- Group row text: the first export column holds `labels.groupRow({ value, count })` (default `` `${value} (${count})` ``, the value as `plainText` writes it) or, for the group of empty values, `labels.emptyGroup` (default `'(empty)'`) with the count the same way; the other columns hold the group's totals (`toValue(totals[columnId])`), so Excel keeps numbers numeric. New `ExportLabels` keys need their English default and JSDoc.
- What is written: rows in memory → every group and every row (closed groups' too), in the grouped order. A `dataSource` → what the table has loaded, in shown order (group rows and loaded rows), or with `allRows` the top-level groups only (requested with `grouping` and `groupPath: []`). `rows: 'selected'` → selected rows only, no group rows (as today).
- Excel: `outlineLevel` = the row's depth (group rows of the top level 0, their rows 1, …; detail rows depth + 1), `summaryBelow="0"`, `outlineLevelRow` the deepest level, no autoFilter while outlined; a group row's first cell bold (the header style), its totals in the normal number formats.
- PDF: a group row gets the header fill and bold text; every row's first cell is indented `GROUP_INDENT` (12 pt) per depth.
- Size: the export budgets (plugin 3.0 kB, Excel writer 3.3 kB, PDF writer 3.1 kB) will need raising; measure, then ask the maintainer before changing any limit.

## Review Focus

1. **Detail rows in a grouped table**: they stay under their own row, one level deeper. Test in Task 3.
2. **The group of empty values and a group whose value is a date**: their first cell reads `(empty) (2)` and `2026-11-20 (3)`. Test in Task 2.
3. **A grouped `dataSource` with closed groups**: only group rows are written for them (their rows aren't loaded), no empty lines. Test in Task 2.
4. **Pinned rows in a grouped table**: written as today, at depth 0, not as group rows. Test in Task 2.
5. **`rows: 'selected'` in a grouped table**: no group rows, selected rows in grouped order. Test in Task 2.

---

### Task 1: Group rows in the grouped order

**Files:**
- Modify: `packages/core/src/table/create-table.ts`, `model-types.ts` (`groupedOrder()` lists group rows too)
- Modify: `packages/table/src/plugins.ts` (`GroupedRow<T>` type; `groupedRows()` returns it), `packages/table/src/argus-table.ts`, `packages/table/src/types.ts` (re-export `GroupedRow`)
- Test: `packages/core/src/table/grouping.test.ts`, `packages/table/src/grouping.test.ts`

**Interfaces:**
- Produces: `TableModel.groupedOrder(): readonly { index: number; id: string; depth: number; group: GroupRowInfo | undefined }[] | undefined` (group rows: `index` is their source index, `group` their info); `type GroupedRow<T> = { id: string; depth: number } & ({ index: number; row: T; group?: undefined } | { group: GroupRowInfo; row?: undefined })`; `PluginHost.groupedRows(): readonly GroupedRow<T>[] | undefined`.

- [ ] **Step 1: Failing tests:** `groupedOrder()` for `grouping: ['region']` sorted by amount lists `[APAC group, d, b, EU group, a, c, e]` with depths `[0, 1, 1, 0, 1, 1, 1]`; `host.groupedRows()` gives group entries with `group.value` and data entries with `row`.
- [ ] **Step 2: Run** core and `src/grouping.test.ts` — FAIL.
- [ ] **Step 3: Implement**; export's current use (data rows only) filters `row` entries until Task 2.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: group rows in groupedRows()`.

### Task 2: Collecting group rows

**Files:**
- Modify: `packages/export/src/sheet.ts` (`ExportSheet.outline?: { depth: number; group: boolean }[]`, one per entry of `rows`), `packages/export/src/collect.ts`, `packages/export/src/labels.ts` (`groupRow`, `emptyGroup`)
- Test: `packages/export/src/plugin.test.ts`

- [ ] **Step 1: Failing tests** (CSV through `exportTable`, which reads the sheet): a table in memory grouped by city writes `Oslo (2)` before Ann and Eve, then `Lima (1)`…; totals in a summed column; Review Focus 2, 4, 5; a grouped `dataSource` with one open group writes the group rows and the open group's loaded rows (Review Focus 3); `allRows` with a grouped `dataSource` writes the top-level groups, requested with `groupPath: []`.
- [ ] **Step 2: Run** `pnpm nx test export` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(export): collect group rows`.

### Task 3: Writers

**Files:**
- Modify: `packages/export/src/csv.ts` (nothing new to lay out: group rows are rows; check the doc comment), `packages/export/src/xlsx/xlsx.ts`, `packages/export/src/pdf/pdf.ts`
- Test: `packages/export/src/xlsx/xlsx.node.test.ts`, `packages/export/src/pdf/pdf.node.test.ts`, `packages/export/src/csv.node.test.ts`

- [ ] **Step 1: Failing tests:** Excel: rows carry `outlineLevel` by depth, `outlineLevelRow` is the deepest, `summaryBelow="0"`, no autoFilter, a group row's first cell uses the header style and its total stays a number; with detail rows, a detail row's level is its row's depth + 1 (Review Focus 1). PDF: a group row's text is bold (`/F2`) on a fill, first cells move right by 12 pt per level. CSV: group rows are lines in order.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/export exec vitest run --project node` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(export): write group rows as outlines, shaded rows and lines`.

### Task 4: Docs, size and checks

**Files:**
- Modify: `packages/export/README.md` (grouped tables), `apps/docs/src/content/docs/features/row-grouping.mdx` (export sentence), `skills/argus-table-integrate/references/addons.md`, `CLAUDE.md` (`packages/export` paragraph), ADR 0014 (a line), `.changeset/row-grouping-export.md` (`@argus-table/export` minor; `argus-table` patch for `groupedRows`)
- [ ] **Step 1:** Docs as listed; `pnpm nx run-many -t lint typecheck build -p docs` and `pnpm nx test skills` — PASS.
- [ ] **Step 2:** `pnpm size`; report the export budgets to the maintainer and set only the limits they approve.
- [ ] **Step 3:** Full check: prettier, lint, core, table and export (`BROWSERS=all`), wrappers generate clean, Storybook, docs e2e for the export page.
- [ ] **Step 4:** Whole-branch review on the most capable model, fixes, PR.
