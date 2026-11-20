# Row grouping, PR 1 (local data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group local `data` by columns' values: group rows with value, count and totals that open and close like tree rows, selectable by group, sortable and filterable, saved with `getState()`.

**Architecture:** Grouping is a fourth way core arranges rows, built as a tree: a new step builds a `GroupedRows` (the `RowTree` shape, with group rows after the data rows and one hidden child per group) over the filtered rows, then the existing tree steps (`layoutTree`, `showOpen`) and `ModelRows` serve it unchanged, so keys, ARIA, `treeExpanded`, `shownAncestor` and branch selection need no grouping branch. `RowStructure` gains `grouped` and `groupAt(index)`; rendering, Enter, selection and export read those.

**Tech Stack:** TypeScript (strict), Lit 3, Vitest (Node for core, browser mode for the table), Playwright, Nx, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-20-row-grouping-design.md` (approved 20 November 2026). This plan is the spec's delivery item 1, plus `PluginHost.grouping()` / `setGrouping()` from item 2 (so the controllable `grouping` and its event ship together and are tested); item 2 keeps only the column-menu items.

## Global Constraints

- Public API: additions only (ADR 0004). Every new property, event, part, label and type is documented in JSDoc on `ArgusTable` (CEM) and in core `types.ts`; wrappers regenerated (`pnpm --filter @argus-table/{react,vue,angular} generate`); `skills/argus-table-integrate/scripts/lib/api.mjs` and `references/api.md` updated (`nx test skills`).
- Size: CDN bundle (`packages/table/.size-limit.json`) raised from `56 kB` to the measured size plus at most 0.3 kB, never above `61 kB`; the PR description states `pnpm size` before and after.
- Ungrouped tables: no grouping work per row or per cell. Read `model.rows` once per render and call `groupAt` only when `rows.grouped`.
- No hard-coded user-visible text: new `TableLabels` keys with English default, JSDoc, and German text in the Features/Labels story.
- Grouping is ignored with one `console.warn` when tree rows are set (`getSubRows` / `getParentId`) and, until PR 3, with a `dataSource`.
- Group ids: `'\u0000g' + JSON.stringify(path)`, `path` the flat array `[columnId, key, columnId, key, …]` from the top level down, `key` the grouping key (below). Documented in the `grouping` JSDoc.
- Grouping key of a value: `Date` → `getTime()` (an invalid date → `null`); `undefined`, `null`, `''` → `null` (the empty group); other values as they are, compared with SameValueZero (a `Map` key). Values that `JSON.stringify` can't round-trip (objects) still group by identity but get their id from `String(value)`; document "group by primitive values or dates".
- Changesets: `argus-table` minor; `@argus-table/export` patch; `@argus-table/vue`, `@argus-table/angular` minor (the `fixed` group versions them together anyway).
- Tests run in Chromium, Firefox and WebKit for the table (`BROWSERS=all`); core in Node.

## Review Focus

1. **Hidden grouped column** (`columnVisibility` hides it): it still groups (hidden columns still sort and read). Test in Task 3.
2. **`treeExpanded` holding group ids after the grouping changes**: stale ids stay in the state, harmlessly; the same grouping again reopens those groups. Test in Task 3.
3. **Active cell inside a group that closes**: it moves to the group row (`shownAncestor`), as under a collapsed tree row. Test in Task 6.
4. **New `data` with the same values**: open groups stay open (ids come from values), and a group whose rows all left disappears. Test in Task 3.
5. **A million rows grouped two levels deep**: building groups and totals stays one pass per level and per totalled column; opening a group reruns only `showOpen`. Benchmark in Task 8.

---

### Task 1: Public types and column options

**Files:**

- Modify: `packages/core/src/types.ts` (ColumnDef, TableState, new types)
- Modify: `packages/core/src/columns/resolve-columns.ts` (pass the new fields through `ResolvedColumn`)
- Modify: `packages/core/src/table/model-types.ts` (`TableModelOptions.grouping`)
- Modify: `packages/core/src/index.ts`, `packages/table/src/types.ts`, `packages/table/src/index.ts` (exports, `TContent` fixed to `CellContent`)
- Modify: `packages/table/src/argus-column.ts` (`groupable` boolean attribute, `aggregate` attribute/property, `groupCell` property)
- Test: `packages/core/src/columns/resolve-columns.test.ts`, `packages/table/src/argus-column.test.ts`

**Interfaces:**

- Produces (core `types.ts`, public):
  - `type GroupingState = readonly string[]`
  - `type ColumnAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count' | ((values: readonly unknown[], context: { rowIds: readonly string[] }) => unknown)`
  - `interface GroupRowInfo { id: string; groupColumnId: string; value: unknown; count: number; depth: number; totals: Readonly<Record<string, unknown>> }` (`value`: the first row's value as the accessor read it, `undefined` for the empty group; `count`: data rows under it, nested levels included; `totals`: by column id, only columns with `aggregate`)
  - `interface GroupCellContext extends GroupRowInfo { index: number; columnId: string; total: unknown }` (`columnId`: the cell's column; `total`: `totals[columnId]`)
  - `ColumnDef.groupable?: boolean`, `ColumnDef.aggregate?: ColumnAggregate`, `ColumnDef.groupCell?: (context: GroupCellContext) => TContent`
  - `TableState.grouping?: GroupingState`
  - `interface GroupingChangeDetail { grouping: GroupingState; columnId: string }`
- Produces (`model-types.ts`): `TableModelOptions.grouping?: GroupingState`; `ResolvedColumn.groupable: boolean`, `.aggregate: ColumnAggregate | undefined`, `.groupCell`.

- [ ] **Step 1: Write the failing tests** — `resolveColumns` keeps `groupable` (`false` by default, `true` when set), `aggregate` and `groupCell` as given; `<argus-column groupable aggregate="sum">` yields `{ groupable: true, aggregate: 'sum' }` and an unknown `aggregate` string yields `undefined`.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/core exec vitest run src/columns/resolve-columns.test.ts` and `pnpm --filter argus-table exec vitest run src/argus-column.test.ts` — expect FAIL.
- [ ] **Step 3: Add the types and fields** with JSDoc written for app developers (the `aggregate` JSDoc states: built-ins read numbers and numeric strings, `min`/`max` dates too, `count` counts non-empty values, totals cover every data row under the group with filters applied, ignored with a `dataSource`).
- [ ] **Step 4: Run** the two commands — expect PASS; `pnpm nx run-many -t typecheck -p core argus-table` passes.
- [ ] **Step 5: Commit** `feat(core): grouping types and column options`.

### Task 2: The grouping step and totals (core, pure)

**Files:**

- Create: `packages/core/src/table/group-rows.ts`
- Create: `packages/core/src/table/aggregate.ts`
- Test: `packages/core/src/table/group-rows.test.ts`, `packages/core/src/table/aggregate.test.ts`

**Interfaces:**

- Consumes: `RowTree<TData>` (`row-tree.ts`), `ResolvedColumn`, `autoSortFn` (`sort-fns.ts`), `GroupRowInfo` (Task 1).
- Produces:
  - `aggregate(kind: ColumnAggregate, values: readonly unknown[], rowIds: () => readonly string[]): unknown` — `rowIds` called only for a function `kind`.
  - `interface GroupedRows<TData> extends RowTree<TData | undefined>`, with source indexes: `0 … n-1` the data rows (`n = data.length`, every data row, kept or not), `n … n+g-1` the group rows, then one hidden child per group (`n+g … n+2g-1`). `rows[i]` is `undefined` for `i ≥ n`. `ids`: data rows' ids (from the `rowId` given), group ids, hidden children `'\u0000' + groupId`. `parent`, `depth`, `childCount` (a group's: its kept children plus 1 for the hidden child). Extra members: `readonly size: number` (`n`), `readonly groups: number` (`g`), `kept: readonly number[]` (the filtered data rows and every group, ascending, the input to sorting), `info(row: number): GroupRowInfo | undefined` (for `n ≤ row < n+g`), `key(row: number, columnId: string): unknown` (a group row's sort key: its grouping value's key for its own column, its total for a column with one, else `undefined`).
  - `buildGroups<TData>(data: readonly TData[], filtered: readonly number[], grouping: readonly ResolvedColumn<TData, unknown>[], totalled: readonly ResolvedColumn<TData, unknown>[], rowId: (dataIndex: number) => string): GroupedRows<TData>`

- [ ] **Step 1: Write failing tests** in `aggregate.test.ts`: `sum` of `[1, '2', 'x', undefined]` is `3`; `avg` of `[2, 4]` is `3` and of `[]` is `undefined`; `min`/`max` of numbers and of `Date`s (returns the `Date`); `count` of `[0, '', null, undefined, 'a']` is `2` (`''`, `null`, `undefined` are empty; `0` isn't); a function gets the values and lazily the row ids.
- [ ] **Step 2: Write failing tests** in `group-rows.test.ts` (fixture: 6 rows with `region` and `status` and `amount`):
  - one level: groups in ascending value order with the empty group last; `count`s; `parent` of each data row is its group; `depth` 0 for groups, 1 for rows; ids `'\u0000g["region","EU"]'`.
  - two levels: inner groups' `depth` 1, rows' 2; inner id `'\u0000g["region","EU","status","Open"]'`; outer `count` covers nested rows.
  - `filtered` drops rows: a group with no rows left doesn't exist; counts and `sum` totals cover the filtered rows only.
  - `Date` values group by time; `undefined`, `null` and `''` share the empty group (`value: undefined`, key `null` in the id).
  - `childCount` of a group is its children + 1; the hidden child's parent is the group and its id `'\u0000' + groupId`.
  - `key(groupRow, 'region')` is the value's key; `key(groupRow, 'amount')` the total; `key(groupRow, 'other')` `undefined`.
  - `totals` holds only totalled columns; each value read once (a counting accessor sees `filtered.length` reads per totalled column).
- [ ] **Step 3: Run** `pnpm --filter @argus-table/core exec vitest run src/table/group-rows.test.ts src/table/aggregate.test.ts` — expect FAIL.
- [ ] **Step 4: Implement.** One pass per level: bucket the current level's members by key in a `Map` (insertion order), then order each level's groups by key with `autoSortFn` on the keys (empty last), and number group rows level by level so a parent's index is below its children's (`layoutTree` only needs parents present). Totals: one pass per totalled column over `filtered`, accumulating into each row's innermost group and its ancestors (built-ins keep running sums/min/max/counts; a function column collects values per innermost group and concatenates for ancestors).
- [ ] **Step 5: Run** the tests — expect PASS.
- [ ] **Step 6: Commit** `feat(core): build group rows and totals`.

### Task 3: Grouped rows in the pipeline, the structure and the model

**Files:**

- Modify: `packages/core/src/table/row-pipeline.ts`
- Modify: `packages/core/src/table/row-structure.ts` (`RowStructure.grouped`, `groupAt`; `ModelRows`; `RemoteTree` gets `grouped = false`, `groupAt() { return undefined }`)
- Modify: `packages/core/src/data/remote-tree.ts`
- Modify: `packages/core/src/table/create-table.ts`, `model-types.ts`
- Test: `packages/core/src/table/create-table.test.ts` (new `describe('grouping')`), `packages/core/src/table/row-structure.test.ts` (grouped fixture in the contract suite)

**Interfaces:**

- Consumes: `buildGroups`, `GroupedRows` (Task 2).
- Produces:
  - `RowPipeline.groups(): GroupedRows<TData> | undefined` — memoized on the filtered rows array, the resolved grouping columns (ids in order), the totalled columns, `valueVersion` and `getRowId`; `undefined` (and warns once) with `getSubRows`/`getParentId` or `remote`; `undefined` when no listed id is a `groupable` column (unknown, duplicate and non-groupable ids dropped).
  - `RowPipeline.treeSteps()` returns the grouped steps when `groups()` is defined: `sortRows(data, grouped.kept, sorting, columnOf)` where `columnOf` wraps each column's `getValue` so indexes `≥ n` read `grouped.key(i, id)`, then `layoutTree(grouped, sorted)`, `holdsMatch: undefined`. `rows()`, `rowId()`, `indexOf()`, `orderIndexOf()` (sized `grouped.rows.length`) and `#isOpen` work off the steps' tree; `tree()` keeps meaning the data's own tree (so `indexesPassing`, `filterValues`, `sourceRow` stay about data rows).
  - `RowStructure.grouped: boolean` and `RowStructure.groupAt(index: number): GroupRowInfo | undefined`.
  - Model: `tree` is true while grouped; `rowAt`, `valueAt`, `cellContext` return `undefined` for group rows; `selectableIds()` leaves group ids out; `sourceRow(i)` unchanged (source indexes `≥ n` give `undefined`).
  - `TableModel.groupedOrder(): readonly number[] | undefined` — the data rows' source indexes in grouped, sorted order with every group open (the steps' `layout.order` without indexes `≥ n`), memoized per layout; `undefined` when not grouped.

- [ ] **Step 1: Write failing tests** (`create-table.test.ts`, `describe('grouping')`, `region` groupable):
  - `grouping: ['region']` with `treeExpanded: []` → `rowCount` is the number of groups; `rows.groupAt(0)` is `{ id: '\u0000g["region","APAC"]', groupColumnId: 'region', value: 'APAC', count: 2, depth: 0, totals: {} }`; `rowAt(0)` and `cellContext(0, 'region')` are `undefined`; `tree` is `true`; `treeRow(0)` has `hasChildren: true, open: false, forced: false`.
  - opening a group (`treeExpanded: [groupId]`) shows its rows after it with `depth` 1, `parent` the group's index; `nextTreeExpanded(groupId, true)` is accepted; a data row's id is refused (`mayToggle` false: no children).
  - `sorting: [{ id: 'amount', desc: true }]` with `amount` aggregated: groups ordered by total descending, rows inside by amount; with `amount` not aggregated: groups keep value order, rows inside sort.
  - `sorting` on the grouped column `desc`: groups reverse, empty group still last.
  - a filter leaving no rows in a group removes the group; `quickFilter` too.
  - non-`groupable` and unknown ids in `grouping` are ignored; `grouping` with `getSubRows` warns once and doesn't group.
  - Review Focus 1: the grouped column hidden through `columnVisibility` still groups.
  - Review Focus 2: `treeExpanded` with a group id, then `grouping` changed and changed back → that group shows open again.
  - Review Focus 4: new `data` with the same values keeps the group open; a group whose rows all left is gone.
  - `groupedOrder()` lists every kept data row, closed groups' included, group by group in sort order;
  - `selectableIds()` holds data ids only; `branchCheck` / `branchSelectAll` never yield a group id (the hidden child keeps it out); `shownAncestor(rowIdInClosedGroup)` is the group's index.
  - Ungrouped: a model without `grouping` has `rows.grouped === false` and `rows.groupAt(0) === undefined`.
- [ ] **Step 2: Extend the contract suite** in `row-structure.test.ts` with a fixture `{ name: 'data, grouped', make: () => model({ data: …, columns: [{ id: 'region', accessor: 'region', groupable: true }], grouping: ['region'], treeExpanded: [<first group id>] }) }`.
- [ ] **Step 3: Run** `pnpm --filter @argus-table/core exec vitest run` — expect the new tests to FAIL.
- [ ] **Step 4: Implement** as in Interfaces. `ModelRows.tree` is `pipeline.treeSteps() !== undefined`; `ModelRows.depthAt` and `mayToggle` read the steps' tree (`mayToggle` keeps "any row with children in the whole tree"); `groupAt` reads `groups()?.info(rows()[index])`.
- [ ] **Step 5: Run** `pnpm --filter @argus-table/core exec vitest run` — expect PASS, all existing tests unchanged.
- [ ] **Step 6: Commit** `feat(core): grouped rows as a tree in the row model`.

### Task 4: The `grouping` property, its event and the plugin host

**Files:**

- Modify: `packages/table/src/argus-table.ts` (property, `controllable`, `getState`/`setState`, JSDoc incl. `@fires`, `TableController` options)
- Modify: `packages/table/src/controllers/table-controller.ts`, `controllers/state-events.ts` (order list)
- Modify: `packages/table/src/events.ts` (`GROUPING_CHANGE = 'argus-grouping-change'`, `HTMLElementEventMap`)
- Modify: `packages/table/src/plugins.ts`, `plugin-host.ts`
- Test: `packages/table/src/grouping.test.ts` (new), `packages/table/src/saved-state.test.ts`

**Interfaces:**

- Consumes: `GroupingState`, `GroupingChangeDetail`, `GroupRowInfo` (Task 1), `model.rows.grouped/groupAt` (Task 3).
- Produces:
  - `ArgusTable.grouping: GroupingState` (default `[]`), controllable like `sorting`.
  - `PluginHost.grouping(): GroupingState`, `PluginHost.setGrouping(next: GroupingState, columnId: string): void` (drops ids of columns that aren't `groupable`; goes through `StateEvents.change`, so the event carries `columnId`), `PluginHost.group(index: number): GroupRowInfo | undefined` (body index in the current order), `PluginHost.groupedRows(): readonly { id: string; row: T; index: number }[] | undefined` (from `model.groupedOrder()`: `index` the source index, `row` `sourceRow(index)`, `id` its row id; `undefined` when not grouped).
  - With a `dataSource`, `grouping` is ignored with one warning ("argus-table: grouping with a dataSource isn't supported yet; it is ignored.").

- [ ] **Step 1: Write failing tests** (`grouping.test.ts`, using `fixture()` and a test plugin to reach the host):
  - setting `grouping` groups the body (`aria-rowcount` counts group rows), and the host gets `role="treegrid"`.
  - `host.setGrouping(['region'], 'region')` uncontrolled: applies, then fires `argus-grouping-change` with `{ grouping: ['region'], columnId: 'region' }` after the update; controlled (`grouping` set by the app): fires the proposed value right away and changes nothing.
  - `host.group(0)` returns the group's info; `host.group(i)` for a data row is `undefined`; `host.groupedRows()` is `undefined` ungrouped and lists every data row (closed groups' too) with its id grouped.
  - `getState().grouping` round-trips through `setState()`; `setState({ grouping })` while controlled is skipped.
  - with a `dataSource`, `grouping` doesn't group and warns once.
- [ ] **Step 2: Run** `pnpm --filter argus-table exec vitest run src/grouping.test.ts src/saved-state.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**, following `sorting`'s wiring (property, `controllable`, `restore()`, `TableState`, `getState`), and `StateEvents`' order list for the new event.
- [ ] **Step 4: Run** the tests — expect PASS.
- [ ] **Step 5: Commit** `feat(table): grouping property, event and plugin host members`.

### Task 5: Rendering group rows

**Files:**

- Modify: `packages/table/src/render/body.ts` (parts, count), `packages/table/src/render/cells.ts` (group cell content), `packages/table/src/labels.ts`, `packages/table/src/styles/base.ts`
- Modify: `packages/themes/src/*.css` (modest defaults for the new parts)
- Modify: `apps/storybook` Features/Labels story (German text)
- Test: `packages/table/src/grouping.test.ts`, `packages/table/src/labels.test.ts`

**Interfaces:**

- Consumes: `model.rows.grouped`, `model.rows.groupAt(index)`, `ResolvedColumn.groupCell`, `formatValue`.
- Produces:
  - Parts: `row-group` on a group row (added to its `row` parts), `cell-group` on its cells, `group-count` on the count (`<span part="group-count">` in the shadow root after the tree column's slot).
  - Labels: `groupCount: (values: { count: number }) => string` (default `` `(${String(count)})` ``, German the same), `emptyGroup: string` (default `'(empty)'`, German `'(leer)'`).
  - Light-DOM content of a group row: tree column → `groupCell(context)` if the column has one, else `formatValue(value)` (or `labels.emptyGroup` for the empty group); other columns → `groupCell(context)` if set, else `formatValue(totals[columnId])` when the column has `aggregate`, else nothing. `context.total` is `totals[columnId]`.

- [ ] **Step 1: Write failing tests:** a grouped table renders one row per group whose `part` includes `row-group` (and its cells `cell-group`), its tree-column cell slots the value text and the shadow root shows `(2)` in `[part~="group-count"]`; a totalled column's group cell shows the sum; a column with `groupCell` gets the context (`value`, `count`, `total`, `depth`, `groupColumnId`, `columnId`) and renders its result; the empty group shows `(empty)`; labels override `groupCount` and `emptyGroup`; group rows' cells have `aria-readonly="true"` and the row `aria-level`, `aria-expanded="false"`, `aria-setsize`, `aria-posinset`.
- [ ] **Step 2: Run** `pnpm --filter argus-table exec vitest run src/grouping.test.ts src/labels.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** In the row loops, read `const grouped = model.rows.grouped` once per render and call `groupAt` once per row only when `grouped`. Add the parts and tokens to the `ArgusTable` JSDoc (`@csspart row-group`, `cell-group`, `group-count`). Themes: the group row uses the header's font weight.
- [ ] **Step 4: Run** the tests, then `BROWSERS=all pnpm --filter argus-table exec vitest run` — expect PASS everywhere.
- [ ] **Step 5: Commit** `feat(table): render group rows, their counts and totals`.

### Task 6: Keys, clicks, selection, editing and export

**Files:**

- Modify: `packages/table/src/controllers/keyboard.ts` (Enter on a group row toggles it via the element's tree toggle path)
- Modify: `packages/table/src/controllers/selection.ts`
- Modify: `packages/export/src/collect.ts`
- Test: `packages/table/src/grouping.test.ts`, `packages/table/src/selection.test.ts`, `packages/editing/src/*.test.ts` (one test), `packages/export/src/collect.test.ts`

**Interfaces:**

- Consumes: `model.rows.groupAt`, `PluginHost.groupedRows`, `readValue` (Task 4), the element's `#toggleTree`.
- Produces: `SelectionController.#branches()` is `this.mode === 'multi' && model.tree && (this.#host.selectBranches || model.rows.grouped)`.

- [ ] **Step 1: Write failing tests:**
  - Enter on any cell of a group row toggles it (`argus-tree-expanded-change` with `open: true`, then `false`); Enter on a data row still fires `argus-cell-click`.
  - A click on a group row's cell makes it active and fires no `argus-row-click` / `argus-cell-click`.
  - Review Focus 3: the active cell on a data row inside a group stays on the group row after the group closes.
  - Selection, `multi` with checkboxes, `selectBranches` unset: ticking a group selects its rows (filters applied) and never its id; its checkbox is `indeterminate` when some are; select-all selects data ids only; Shift-click from a row in one group to a row in another selects the data rows between, skipping group ids. `single` mode: clicking or Space on a group row selects nothing.
  - Editing: Enter, F2 and a double-click on a group row's cell start no editor.
  - Export: `collect` over a grouped table writes data rows only (no group rows), in the shown order of open groups' rows — and closed groups' rows too, since an export is of the data.
- [ ] **Step 2: Run** `pnpm --filter argus-table exec vitest run src/grouping.test.ts src/selection.test.ts` and the editing and export tests — expect FAIL.
- [ ] **Step 3: Implement.** Selection skips rows where `groupAt` is defined for row clicks, Space and range ids. Export: when `host.groupedRows()` is defined, collect those rows (values through `host.readValue(row, columnId, index)`, ids for `detail` from `id`) instead of walking `rowCount`; otherwise as today.
- [ ] **Step 4: Run** the tests in all engines — expect PASS.
- [ ] **Step 5: Commit** `feat(table): keys, selection and export for group rows`.

### Task 7: Wrappers

**Files:**

- Modify: `packages/react/src/generated/elements.ts`, `packages/vue/src/generated/*`, `packages/angular/src/generated/*` (regenerated)
- Modify: `packages/vue/src/content.ts` (slot `#row-group-<id>` → `groupCell`), `packages/angular/src/content.ts` (`ArgusGroupCellDirective`, `ng-template[argusGroupCell]="<column id>"` → `groupCell`), `packages/angular/src/index.ts` (export the directive)
- Test: `packages/react/src/*.test.tsx`, `packages/vue/src/test/Declarative.vue` + its test, `packages/angular/src/test/*`

**Interfaces:**

- Consumes: `ColumnDef.groupCell` (Task 1), the `grouping` property and `argus-grouping-change` event (Task 4).

- [ ] **Step 1: Write failing tests** per wrapper: `grouping` binds (two-way where the wrapper derives it from `argus-grouping-change`), and a group cell renders framework content: React `groupCell` returning JSX, Vue `<template #row-group-amount="{ total }">`, Angular `<ng-template argusGroupCell="amount" let-ctx>`.
- [ ] **Step 2: Build** `pnpm nx build argus-table` and run the three `generate` scripts — expect the generated files to change; run the wrapper tests — expect FAIL until the content plugins learn `groupCell`.
- [ ] **Step 3: Implement** the Vue slot and the Angular directive alongside the existing `#cell-<id>` / `argusCell` handling.
- [ ] **Step 4: Run** `pnpm nx run-many -t test lint typecheck -p react vue angular generate-wrappers` — expect PASS.
- [ ] **Step 5: Commit** `feat(wrappers): grouping and group cells in React, Vue and Angular`.

### Task 8: Docs, skills, size, benchmark

**Files:**

- Create: `apps/storybook/src/features/grouping.stories.ts` (title `Features/Row grouping`; add it to `apps/docs/src/lib/old-urls.ts` `STORYBOOK_PAGES`)
- Create: `apps/docs/src/content/docs/features/row-grouping.mdx` and `apps/docs/src/examples/grouping/basic/{html,react,vue,angular}/` (frontmatter `since` the next minor)
- Create: `docs/adr/0014-row-grouping.md` (and list it in `docs/adr/README.md`)
- Modify: `skills/argus-table-integrate/scripts/lib/api.mjs`, `references/api.md`, `references/gaps.md` (local grouping no longer a gap; remote grouping until PR 3), `scripts/lib/libraries.mjs` (`row-grouping` fits per library) and `references/migrate/*.md` rows to match; `HARD_GAPS` keeps `row-grouping` only if a library's grouping is server-side only
- Modify: `CLAUDE.md` (a **Row grouping** paragraph after **Tree rows**)
- Modify: `packages/table/.size-limit.json`
- Create: `.changeset/row-grouping.md` (argus-table minor), `.changeset/row-grouping-export.md` (export patch), `.changeset/row-grouping-wrappers.md` (vue, angular minor)

- [ ] **Step 1: Story** with a play function (open a group with the keyboard, check the count and a total) and axe; **docs page** with the four flavours (grouping by two columns, a `sum` total, a currency `groupCell`); run `pnpm nx run storybook:test-storybook` (twice after a build, per the repo's note) and `pnpm nx run docs:lint docs:typecheck docs:e2e` — expect PASS.
- [ ] **Step 2: Skills**: update `api.mjs` / `references/api.md` / gaps / libraries / migrate references; run `pnpm nx test skills` — expect PASS.
- [ ] **Step 3: Benchmark** (Review Focus 5): a throwaway Node test (not committed) timing `treeSteps()` for 1,000,000 rows grouped by two columns with one `sum` total, and the time to reopen after toggling one group; record both in the PR description, and that an ungrouped model's per-row reads are unchanged (the #199 micro-benchmark shape).
- [ ] **Step 4: Size**: `pnpm --filter argus-table exec size-limit`; set `limit` to the measured size rounded up by at most 0.3 kB (≤ `61 kB`); `pnpm size` passes.
- [ ] **Step 5: ADR 0014, CLAUDE.md, changesets** written from the user's point of view.
- [ ] **Step 6: Full check** in the Linux copy: `prettier --check` on changed files, `pnpm lint`, core and table tests (`BROWSERS=all`), Storybook, e2e (`BROWSERS=chromium` all specs; tree specs in all engines), CEM diff shows only the additions, wrappers regenerate clean, `nx test skills`, `pnpm size`.
- [ ] **Step 7: Commit** `docs: row grouping` and open the PR.
