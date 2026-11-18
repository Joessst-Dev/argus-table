# Exporting detail rows: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@argus-table/export` exports each row's detail rows, which the app supplies through a `detail` option: indented and grouped in Excel, indented in PDF, flattened in CSV, and offered with or without details in the column menu.

**Architecture:** `ExportSheet` gains an optional `detail` (columns once, detail rows per entry of `rows`). `collect()` fills it through a new `detail.ts` (in-order calls of `detail.rows()`, at most 6 in flight, yielding every 50 rows). Each writer lays it out on its own. The plugin adds an "Export with details" menu group.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `.js` import suffixes), Vitest (Node project `writers` for `*.node.test.ts`, browser project `plugin` for `plugin.test.ts`), Lit for the table, pnpm/Nx.

**Spec:** `docs/superpowers/specs/2026-11-18-export-detail-rows-design.md`

## Global Constraints

- An export without `detail` (or with `detail: false`) writes exactly the files it writes today: every existing writer and plugin test passes unchanged.
- `detail` doesn't depend on `rowDetail`; pinned rows never get detail rows; rows `host.element.rowExpandable` rejects get none and `rows()` isn't called for them.
- `rows(row, { rowId, signal })` is called once per exported body row, in row order, at most 6 calls in flight; collection yields with `setTimeout(0)` every 50 rows; an abort or a rejected `rows()` rejects the export.
- `rowId` is `host.rowId(i)` in the view/selected paths and `getRowId(row, index)` else `String(index)` with `allRows` (the ids `collect.ts` uses today).
- Detail values go through `toValue`; CSV formula escaping applies to them too.
- Public additions only (ADR 0004): `ExportDetail`, `ExportDetailColumn`, `detail` option, `withDetails` label. `rows` and `value` use method syntax (bivariant), `ExportOptions<T>` keeps one type parameter.
- Run tests in the scratchpad Linux copy (never `pnpm install` in the mount). `pnpm size` for the export package before the PR; budget raises (plugin 2.8 kB, XLSX 3.1 kB, PDF 2.9 kB) only with the maintainer's approval.
- No hard-coded user-visible text: the menu heading is `labels.withDetails` (`Export with details`), with German text in the labels story and the docs labels example.

## Review Focus

1. `rows()` returns `[]`: Excel and PDF write no detail header for that row; CSV writes the row once with empty detail columns. (Task 2, 3, 4 tests.)
2. A `rows()` that rejects, or an abort while details load: the export rejects and no further `rows()` calls start. (Task 1, `detail.node.test.ts`.)
3. Detail values that are dates, objects or formula-like text: dates stay dates in Excel and `YYYY-MM-DD` in CSV, objects become JSON, `=cmd` is escaped in CSV. (Task 2 test.)
4. `columnGroups` with details in CSV: the group rows get empty cells over the detail columns. (Task 2 test.)
5. More detail columns than table columns in Excel: the extra columns get `<col>` widths too. (Task 3 test.)

---

### Task 1: The `detail` option, the sheet and collecting

**Files:**

- Create: `packages/export/src/detail.ts`
- Modify: `packages/export/src/sheet.ts`, `packages/export/src/collect.ts`, `packages/export/src/index.ts`
- Test: `packages/export/src/detail.node.test.ts` (Node project `writers`: `collectDetails` is DOM-free) and `packages/export/src/plugin.test.ts` (browser project `plugin`)

**Interfaces:**

- Produces (in `collect.ts`, exported from `index.ts` as types):
  ```ts
  export interface ExportDetailColumn<D = unknown> {
    id: string;
    header: string;
    value?(item: D): unknown;
    align?: ColumnAlign;
    width?: number;
  }
  export interface ExportDetail<T = unknown, D = unknown> {
    columns: readonly ExportDetailColumn<D>[];
    rows(
      row: T,
      context: { rowId: string; signal: AbortSignal | undefined },
    ): readonly D[] | Promise<readonly D[]>;
  }
  // CollectOptions<T> gains:  detail?: ExportDetail<T> | false;
  ```
- Produces (in `sheet.ts`): `ExportSheet.detail?: { columns: ExportColumn[]; rows: (ExportValue[][] | undefined)[] }`. `rows` has one entry per entry of `sheet.rows`, `undefined` for pinned rows and rows without details; `ExportColumn` for detail columns: `align` default `'start'`, `width` default `120`, `pin: undefined`.
- Produces (in `detail.ts`): `export async function collectDetails<T>(items: readonly ({ row: T; rowId: string } | undefined)[], detail: ExportDetail<T>, expandable: ((row: T) => boolean) | undefined, signal: AbortSignal | undefined): Promise<(ExportValue[][] | undefined)[]>`.

- [ ] **Step 1: Write the failing tests.** In `detail.node.test.ts`, `describe('collectDetails', …)`, with items `{ row: { id: 'r0' … }, rowId: 'r0' }` …:
  - `'runs at most 6 rows() at a time and keeps row order'`: 20 items, `rows` returns promises resolved by test-held resolvers; after `await new Promise(r => setTimeout(r, 0))` exactly 6 calls are pending; resolving all in reverse order gives results in item order.
  - `'skips undefined items and rows expandable rejects'`: results are `undefined` there and `rows` wasn't called for them.
  - `'yields every 50 rows'`: with 120 synchronous items, a `setTimeout(0)` callback queued before the call runs before the promise settles.
  - `'rejects on a rejected rows() or an abort, starting no more calls'`: rejection on item 1 → rejects with that error; an abort after the first call → rejects with the abort reason, `rows` called at most 6 times.
  - `'writes values through value() or the property named by id, made plain'`: `{ qty: 2, when: new Date(2026, 0, 2) }` with `value: (l) => l.qty * 10` → `[20, Date]`.

  In `plugin.test.ts`, `describe('detail rows', …)`, with `type Line = { product: string; qty: number }`, `lines = (r: Row): Line[] => r.id === 'b' ? [] : [{ product: `${r.name} A`, qty: 1 }, { product: `${r.name} B`, qty: 2 }]` and columns `[{ id: 'product', header: 'Product' }, { id: 'qty', header: 'Qty', align: 'end' }]`:
  - `'calls rows() for body rows only, not pinned rows or rows rowExpandable rejects'`: with `pinnedRows: { top: [data[0]] }` and `rowExpandable: (r) => r.id !== 'c'`, `exportTable(el, 'csv', { detail })` calls the `rows` spy for `a`, `b`, `d` in that order, first with `{ rowId: 'a', signal: undefined }`.
  - `'detail: false turns the plugin's detail off'`: with `tableExport({ detail })`, `exportTable(el, 'csv', { detail: false })` doesn't call `rows` and equals the CSV of a table without `detail`.
  - `'passes the index as rowId with allRows and no getRowId'`: a `dataSource` table, `allRows: true`, no `getRowId` → `rowId`s `'0'`, `'1'`, ….

- [ ] **Step 2: Run** `pnpm --filter @argus-table/export exec vitest run src/detail.node.test.ts` and `BROWSERS=chromium pnpm --filter @argus-table/export exec vitest run src/plugin.test.ts --project plugin -t "detail rows"`. Expected: FAIL (`collectDetails` and `detail` don't exist).
- [ ] **Step 3: Implement** `collectDetails` in `detail.ts` (a fixed pool of 6 workers over an index counter, results by index; `signal?.throwIfAborted()` before each call; `await new Promise(r => setTimeout(r, 0))` after every 50th row started), the types in `collect.ts`, and in `collect()` a parallel `items` array pushed alongside `rows` (`undefined` for pinned rows), then `sheet.detail = { columns, rows: await collectDetails(…) }` only when `options.detail` is an object. Values: `toValue(column.value ? column.value(item) : (item as Record<string, unknown>)[column.id])`.
- [ ] **Step 4: Run** both again (the plugin file in `BROWSERS=all`), then the whole export package. Expected: PASS, existing tests unchanged.
- [ ] **Step 5: Commit** `feat(export): the detail option and collecting detail rows`.

### Task 2: CSV, flattened

**Files:** Modify `packages/export/src/csv.ts`. Test: `packages/export/src/csv.node.test.ts`.

**Interfaces:** Consumes `ExportSheet.detail` (Task 1). `toCsv(sheet, options)` keeps its signature.

- [ ] **Step 1: Write the failing tests** (`describe('detail rows', …)`), sheet with columns `name`, `city`, detail columns `product`, `qty`, rows `Ann/Oslo` (lines `[['x', 1], ['=cmd', new Date(2026, 0, 2)]]`), `Bob/Rome` (`[]`), `Sum/` (pinned: `undefined`):
  - `'repeats the row for each detail row, one line for rows without'`: lines `NAME,CITY,PRODUCT,QTY`, `Ann,Oslo,x,1`, `Ann,Oslo,'=cmd,2026-01-02`, `Bob,Rome,,`, `Sum,,,` (CRLF, `bom: false`).
  - `'leaves the group rows empty over the detail columns'`: with `groups: [[{ text: 'Who', span: 2 }]]` the first line is `Who,,,`.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/export exec vitest run src/csv.node.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `toCsv`: with `sheet.detail`, header and group rows get the detail columns appended (empty in group rows); each row writes `row ++ detailRow` per detail row, or `row ++ empties` when it has none.
- [ ] **Step 4: Run** the file. Expected: PASS, existing tests unchanged.
- [ ] **Step 5: Commit** `feat(export): detail rows in CSV, flattened`.

### Task 3: Excel, indented and grouped

**Files:** Modify `packages/export/src/xlsx/xlsx.ts`. Test: `packages/export/src/xlsx/xlsx.node.test.ts`.

**Interfaces:** Consumes `ExportSheet.detail`. `toXlsx` keeps its signature.

- [ ] **Step 1: Write the failing tests** (`describe('detail rows', …)`), table columns `A`, `B` (width 70), detail columns `p` (width 200), `q`, `r` (three, more than the table's two); row 1 with two detail rows, row 2 with `[]`:
  - `'writes a detail header and rows under their row, one column in, at outline level 1'`: sheet XML has `<row r="3" outlineLevel="1">` whose first cell is `B3` with the `P` header text in the header style, rows 4–5 `outlineLevel="1"` starting at `B`, and row 6 is table row 2 with no outline level and no detail header after it.
  - `'collapses toward the row above'`: contains `<sheetPr><outlinePr summaryBelow="0"/></sheetPr>` before `<sheetViews>` and `<sheetFormatPr defaultRowHeight="15" outlineLevelRow="1"/>`.
  - `'drops the autoFilter with detail rows and widens shared columns'`: no `<autoFilter`; `<col min="2" max="2"` width from 200 px (the detail's `p`, wider than `B`), and a `<col>` for column 4 (detail `r`).
  - Without `detail`, the existing tests stand for "unchanged".
- [ ] **Step 2: Run** `pnpm --filter @argus-table/export exec vitest run src/xlsx/xlsx.node.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `worksheet()`: track the next row number through detail blocks; cell refs of detail cells use `columnName(i + 1)`; widths per spreadsheet column = max over the table column at `i` and the detail column at `i - 1`; omit `autoFilter` when any detail rows were written; frozen panes unchanged.
- [ ] **Step 4: Run** the file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(export): detail rows in Excel, indented and grouped`.

### Task 4: PDF, indented

**Files:** Modify `packages/export/src/pdf/pdf.ts`. Test: `packages/export/src/pdf/pdf.node.test.ts`.

**Interfaces:** Consumes `ExportSheet.detail`. `toPdf` keeps its signature. Indent `DETAIL_INDENT = 16` (pt).

- [ ] **Step 1: Write the failing tests** (`describe('detail rows', …)`), using `read()` and `shown()`:
  - `'writes a detail header and rows under their row, indented 16pt'`: the shown text order is the table header, `Ann`, the detail headers, the two detail values, then `Bob` with no detail header after it; the `Td` x of the first detail header is the x of `Ann` plus 16 (to 0.01).
  - `'repeats the detail header when a block runs onto the next page'`: a row with 80 detail rows on A4 → page 2's shown text starts with the table header, then the detail header.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/export exec vitest run src/pdf/pdf.node.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `toPdf`'s row loop: after a row with detail rows, the detail header (header style) and rows at x + 16, each detail column `width * PX` wide, clipped to the page like table cells; a page break inside a block writes the table header, then the detail header.
- [ ] **Step 4: Run** the file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(export): detail rows in PDF, indented`.

### Task 5: The column menu and labels

**Files:** Modify `packages/export/src/plugin.ts`, `packages/export/src/labels.ts`, `apps/storybook/stories/labels.stories.ts`, `apps/docs/src/examples/labels/data.ts`. Test: `packages/export/src/plugin.test.ts`.

**Interfaces:** `ExportLabels.withDetails: string` (default `'Export with details'`, German `'Mit Details exportieren'`). `headerMenuItems` returns a second `ExportMenuGroup` `{ label: labels.withDetails, items: same formats }` only when the plugin's own options have a `detail` object; the first group's items then call `downloadTable(el, format, { detail: false })`.

- [ ] **Step 1: Write the failing test** `'offers the formats with and without details in the column menu'`: `tableExport({ detail })` → `headerMenuItems('name', host)` has groups labelled `Export` and `Export with details`, each with CSV, Excel, PDF; running the first group's CSV item downloads a CSV without `Product` (spy on `downloadTable`'s anchor click as the existing menu test does), the second's with it. Without `detail`: one group.
- [ ] **Step 2: Run** the `plugin` project for that test. Expected: FAIL.
- [ ] **Step 3: Implement** it, the label with JSDoc, and the German text in both label files (`satisfies` makes the typecheck fail otherwise).
- [ ] **Step 4: Run** `pnpm nx run-many -p export storybook docs -t typecheck` and the `plugin` project in `BROWSERS=all`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(export): export with details from the column menu`.

### Task 6: Docs, story, skill, changeset, size

**Files:**

- Modify: `packages/export/README.md` (options table row for `detail`; a "Detail rows" section with the layouts per format), `apps/docs/src/content/docs/features/export.mdx` (a "Detail rows" section with the new example's `FlavourTabs`, saying which release adds it as the page's other new sections do), `apps/docs/e2e/export.spec.ts`, `apps/storybook/stories/export.stories.ts`, `skills/argus-table-integrate/scripts/lib/api.mjs` (`'detail'` in the options list), `skills/argus-table-integrate/references/api.md`, `CLAUDE.md` (the export package paragraph: one sentence on `detail`).
- Create: `apps/docs/src/examples/export/detail/{html/index.html,html/main.js,react/DetailExport.tsx,vue/DetailExport.vue,angular/detail-export.component.ts}` (orders with lines from `../data.ts`-style data, a CSV and an Excel button exporting with `detail`), `.changeset/export-detail-rows.md` (`'@argus-table/export': minor`, written for users).

- [ ] **Step 1: Write the e2e** in `export.spec.ts`, per flavour: `'${flavour}: CSV with each order's lines'` → the CSV's header line ends with `,Product,Qty` and the first order's lines repeat its id; `expectAccessible`.
- [ ] **Step 2: Add the story** `WithDetails` (orders with lines, `rowDetail` too) whose play function opens a column menu and checks the `Export with details` group is there.
- [ ] **Step 3: Write the examples, docs, README, skill entries, CLAUDE.md line and changeset.**
- [ ] **Step 4: Verify** in the copy: `pnpm nx run-many -t lint typecheck test -p export docs storybook skills`, `pnpm nx run storybook:test-storybook`, the docs e2e for `export.spec.ts` with `BROWSERS=all`, `pnpm --filter @argus-table/export size`, `pnpm exec prettier --check .`. Expected: all pass; if a size budget is over, trim first, then report the numbers and ask before raising it.
- [ ] **Step 5: Commit** `docs(export): detail rows`.
