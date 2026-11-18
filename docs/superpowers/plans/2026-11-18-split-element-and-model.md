# Split `argus-table.ts` and `create-table.ts` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the element's keyboard routing, click events, scrolling and render-input building, and the core model's types, column views and row pipeline, into modules of their own, with no behaviour or API change.

**Architecture:** Behaviour-preserving moves in five PRs into `main`, one at a time, each merged by the builder once CI is green. Logic that only reads the element's state becomes module functions or small classes taking their collaborators as constructor/function arguments; the element keeps every controllable value. Core's closure keeps `update()` and the returned `TableModel` object.

**Tech Stack:** Lit 3, TypeScript (strict, `.js` import extensions, `import type`), Vitest browser mode (table) and Node (core), Nx, pnpm, size-limit.

**Spec:** `docs/superpowers/specs/2026-11-18-split-element-and-model-design.md`

## Global Constraints

- No change to any public API: properties, methods, events, parts, tokens, slots, `PluginHost` members, `TableModel` members, `@argus-table/core`'s exports from `src/index.ts`.
- No behaviour change, no fixes folded in; a bug found on the way goes in the PR body and gets its own PR later.
- The controllables (`#sorting`, `#pinning`, `#visibility`, `#filters`, `#expanded`) and the `#request*` / `#setSort` / `#applySorting` / `#toggle` rules stay on the element; so does the `#pluginHost` literal.
- Existing tests pass unchanged after every commit (only import paths may change).
- Minifier rule: moved code takes dependencies as positional constructor or function arguments stored in `#private` fields, never as option objects with named keys; it gets as few public members as the element needs.
- CDN bundle: the whole series adds at most 0.15 kB gzipped (budget 47 kB, `main` at 46.11 kB). Each PR body states `argus-table.ts` (or `create-table.ts`) lines and the CDN bundle, before → after.
- `argus-table.ts` ends at about 1,600 lines. Not moved: `#syncDetails`, `#keptColumns`, `#headerHandlers`, the conditions in `willUpdate` / `updated`, the row-height probe, `render()`'s style map.
- Core stays DOM-free (its tests run in Node).
- Each PR: a patch changeset for `argus-table` (`.changeset/split-argus-table-<n>.md`, n from 4) worded "Internal: … moved out of the element into their own modules. Nothing changes for apps."; `CLAUDE.md` updated wherever it names a moved member.
- Work in the scratchpad Linux copy (memory `sandbox-node-modules-are-macos`): never `pnpm install` in the mounted repo.

## Review Focus

1. **A nested table inside a cell or a detail panel** must keep its keys, clicks and focus to itself after the moves (the `getRootNode() !== root` and `gridCell(target, root)` checks must take the _outer_ table's `renderRoot`). Covered by `detail-rows.test.ts` "keeps a nested table to itself"; Task 2 adds a key test for a nested table inside a body cell.
2. **Key routing order:** Escape-back-from-panel, then Shift+Tab, then group headers, then panel cells, then the chevron, then plugins, then Alt+Arrow, sort, Enter, then navigation. A plugin's `keydown` must still see a key before the built-in ones, and never on the checkbox or chevron column. Task 2 adds a test that a plugin returning `true` for `Enter` on a body cell stops `argus-row-click`.
3. **The scroll target dropped by the user's own input** (`wheel`, `touchstart`, `pointerdown`, `keydown` on the host) once the listeners live in the new controller, including after the table is moved in the DOM. `saved-state.test.ts` covers the four events; Task 3 adds the reconnect case.
4. **Memo identities in core** (`rowOrder`, `display`, `columns`, `allColumns`, `headerGroups`): a moved memo keyed on the wrong thing doesn't fail a functional test, it makes every update re-sort or re-measure. Task 5 pins the uncovered cases before anything moves.
5. **Generated wrappers and the manifest:** the Custom Elements Manifest must not change. Every task's verification diffs `custom-elements.json` against `main`'s.

---

## Task 0: Working copy and baseline

**Files:** none in the repo.

- [ ] **Step 1: Make or refresh the Linux copy** following memory `sandbox-node-modules-are-macos` (rsync excluding `node_modules`, `dist`, `.nx`; `pnpm install --frozen-lockfile`; official Node 24 first on PATH; a `sync.sh` using its own directory). Check `df -h /tmp` first.
- [ ] **Step 2: Record the baseline** in the copy on `main`: `pnpm nx build argus-table && pnpm --filter argus-table size` (expect ≈ 46.11 kB), `wc -l packages/table/src/argus-table.ts packages/core/src/table/create-table.ts` (2,073 / 1,059), and save `packages/table/dist/custom-elements.json` as `scratchpad/cem-main.json`.

## Per-task verification (referenced as "Verify" below)

Run in the copy after syncing:

```bash
pnpm lint
pnpm test                                                    # all projects
pnpm nx run storybook:test-storybook --skip-nx-cache --output-style=static   # run twice after a rebuild (memory)
pnpm nx build playground && BROWSERS=chromium pnpm test:e2e
pnpm nx build argus-table && diff <(jq -S . scratchpad/cem-main.json) <(jq -S . packages/table/dist/custom-elements.json)
pnpm --filter argus-table size
pnpm nx test skills
pnpm exec prettier --check .                                 # from the repo root, last
```

Expected: all green, the manifest diff empty, size within the series' 0.15 kB.

## PR 4: click events and keyboard routing

### Task 1: `cell-events.ts`: activation and plugin cell targets

**Files:**

- Create: `packages/table/src/cell-events.ts`
- Modify: `packages/table/src/argus-table.ts` (`#onClick`, `#activate` 1802–1863; `#cellTarget` 1997–2022)
- Test: existing `argus-table.test.ts`, `selection.test.ts`, `detail-rows.test.ts`, `plugins.test.ts`

**Interfaces:**

- Produces:
  - `activate<T>(element: HTMLElement, root: Node, model: TableModel<T, CellContent>, path: readonly EventTarget[]): void`: fires `argus-cell-click` then `argus-row-click` exactly as `#activate` does.
  - `cellTargetOf<T>(event: Event, root: Node, model: TableModel<T, CellContent>, nav: NavigationController<T>): CellTarget | undefined`: the body of `#cellTarget`.

- [ ] **Step 1: Check coverage.** Confirm tests exist for: a cell click's detail (`argus-table.test.ts`), a pinned row's click carrying `pinned` (grep `pinned:` near `argus-cell-click`), no click event from the checkbox or chevron column, a panel row firing nothing, `cellOf` returning `undefined` in a panel (`detail-rows.test.ts`) and `rowIndex: 0` in the header. Any missing: write it now against `main`'s code, run it, see it pass, commit (`test: …`).
- [ ] **Step 2: Move** the two bodies into `cell-events.ts`; the element's `#onClick` calls `activate(this, this.renderRoot, this.#table.model, event.composedPath())`, the Enter path likewise, and `#pluginHost.cellOf` / the keyboard path call `cellTargetOf(event, this.renderRoot, this.#table.model, this.#nav)`. Delete `#activate` and `#cellTarget`; drop imports the element no longer uses (`CELL_CLICK`, `ROW_CLICK`, …).
- [ ] **Step 3: Run** `pnpm --filter argus-table exec vitest run src/argus-table.test.ts src/selection.test.ts src/detail-rows.test.ts src/plugins.test.ts`. Expected: PASS, same counts as before.
- [ ] **Step 4: Commit** `refactor: move row and cell click events out of argus-table.ts`.

### Task 2: `controllers/keyboard.ts`

**Files:**

- Create: `packages/table/src/controllers/keyboard.ts`
- Modify: `packages/table/src/argus-table.ts` (`#onKeydown`, `#panelBack`, `#groupKey` 1650–1800), `CLAUDE.md` (line 83 `#panelBack`, line 99 `#groupKey`/`#activate`, and the Keyboard section's "The element's `#onKeydown` handles its own keys first")
- Test: `packages/table/src/argus-table.test.ts`, `packages/table/src/plugins.test.ts`

**Interfaces:**

- Consumes: `activate`, `cellTargetOf` (Task 1).
- Produces:

  ```ts
  export class KeyboardRouter<T> {
    constructor(
      host: HTMLElement & { renderRoot: HTMLElement | DocumentFragment },
      model: () => TableModel<T, CellContent>,
      nav: NavigationController<T>,
      resize: ColumnResize<T>,
      reorder: ColumnReorder<T>,
      plugins: PluginController<T>,
      data: DataController<T>,
      toggle: (index: number) => void,
      sort: (columnId: string) => void,
    );
    readonly onKeydown: (event: KeyboardEvent) => void;
  }
  ```

  `onKeydown` is an arrow-function field (bound), used as `@keydown=${this.#keys.onKeydown}`. `#panelBack` and `#groupKey` become `#private` methods of the class. Routing order exactly as today (Review Focus 2).

- [ ] **Step 1: Write the routing tests** (they pass on `main`; they guard the move):
  - `plugins.test.ts`: `it('a plugin that handles Enter on a body cell stops the row click')`: a plugin whose `keydown` returns `true` for `Enter`; focus a body cell, press Enter; `expect(rowClicks).toHaveLength(0)` and the plugin saw `{ section: 'body', columnId: 'name', rowIndex: 0 }`.
  - `argus-table.test.ts`: `it('keeps keys from a table nested in a cell to that table')`: a column whose `cell` renders an `<argus-table>`; ArrowDown on the inner table's first cell moves the inner active cell (`aria-rowindex` 3 focused inside it) and the outer active cell stays where it was.
- [ ] **Step 2: Run** them on `main`'s code: `pnpm --filter argus-table exec vitest run src/plugins.test.ts src/argus-table.test.ts -t "stops the row click|nested in a cell"`. Expected: PASS. Commit `test: pin key routing before moving it`.
- [ ] **Step 3: Move** the three members into `KeyboardRouter`; the element holds `readonly #keys = new KeyboardRouter<T>(this, () => this.#table.model, this.#nav, this.#resize, this.#reorder, this.#plugins, this.#data, (i) => { this.#toggle(i); }, (id) => { this.#requestSort(id); })` declared after `#reorder`.
- [ ] **Step 4: Update `CLAUDE.md`**: the Keyboard section names `KeyboardRouter` (`controllers/keyboard.ts`) instead of the element's `#onKeydown`; detail rows' "`#panelBack`" and column groups' "the element's `#groupKey`" become `KeyboardRouter`'s; `#activate` becomes `activate()` (`cell-events.ts`).
- [ ] **Step 5: Verify** (all of "Per-task verification").
- [ ] **Step 6: Commit** `refactor: move keyboard routing out of argus-table.ts`; add `.changeset/split-argus-table-4.md`; commit the spec and this plan too (`docs: design and plan for splitting argus-table.ts and create-table.ts`).
- [ ] **Step 7: PR and merge.** Branch `refactor/split-element-4`, push, `gh pr create` with body: moved pieces, lines and bundle before → after (as #148). Merge (squash, delete branch) once CI is green.

## PR 5: scrolling and saved state

### Task 3: `controllers/scroll-target.ts` and `restore()`

**Files:**

- Create: `packages/table/src/controllers/scroll-target.ts`
- Modify: `packages/table/src/controllers/state-events.ts` (add `restore`), `packages/table/src/argus-table.ts` (`scrollToRow` / `#scrollRowTo` / `#bodyInsets` / `scrollToColumn` / `#scrollColumnTo` / `#settled` 982–1086; `setState`'s tail, `#restore`, `#chaseScrollTarget`, `#scrollTarget`, `#dropScrollTarget` and the constructor's listeners 1128–1185, 838–860; `#scrollKeep` 631), `CLAUDE.md` (Saved state section: `#restore()`, `#scrollTarget`)
- Test: `saved-state.test.ts`, `scroll-api.test.ts`

**Interfaces:**

- Produces:
  - In `state-events.ts`: `restore<V>(host: ReactiveElement, name: string, state: Controllable<V>, value: V | undefined): boolean`: the body of `#restore` (`host.requestUpdate(name, old)`).
  - ```ts
    export class ScrollTarget<T> {
      constructor(
        host: ReactiveElement & HTMLElement,
        model: () => TableModel<T, CellContent>,
        virtual: VirtualController,
        data: DataController<T>,
        insets: (layout: RowLayout) => { before: number; after: number },
        measuring: () => boolean,
        scroller: () => HTMLElement | null,
      );
      /** The column `scrollToColumn()` renders with `virtualizeColumns` (was `#scrollKeep`). */
      keep: string | undefined;
      toRow(target: RowTarget, align: ScrollAlign): Promise<boolean>;
      toColumn(id: string, align: ScrollAlign, virtualize: boolean): Promise<boolean>;
      /** `setState()`'s scroll: after its `updateComplete`. */
      restoreScroll(scroll: ScrollState): Promise<void>;
      /** Scrolls on toward the pending target once more rows are counted (`updated()`). */
      chase(count: number): void;
      /** Forgets the pending target: new source, sort or filter, or `setState()`. */
      drop(): void;
    }
    ```

  The constructor adds the four passive listeners (`wheel`, `touchstart`, `pointerdown`, `keydown`) to `host` calling `drop`. `#settled`, `#scrollRowTo`, `#scrollColumnTo` become `#private` methods. The element's public `scrollToRow` / `scrollToColumn` keep their JSDoc and become `await`-and-delegate one-liners (`scrollToRow` passes `options.align ?? 'start'`, `scrollToColumn` `options.align ?? 'nearest'`); `getState()` stays; `setState()` keeps its `version` check and `restore()` calls, then `this.#scroll.drop()`, `await this.updateComplete`, `return this.#scroll.restoreScroll(scroll)` when `scroll` is given. `#bodyInsets` stays on the element (navigation uses it) and is passed in.

- [ ] **Step 1: Write the reconnect test** in `saved-state.test.ts`: `it('drops a pending restored row on wheel after the table moves')`: set up the existing "unknown total" scenario (copy its fixture), `setState({ scroll: { row: 250, inline: 0 } })`, move the element (`el.remove(); container.append(el)`), dispatch `wheel`, let a page arrive; `expect(topRow(el)).toBeLessThan(250)`. Run it on `main`: PASS. Commit `test: pin the scroll target across a move`.
- [ ] **Step 2: Move** as above; `#keptColumns` reads `this.#scroll.keep`; `willUpdate`'s `this.#scrollTarget = undefined` becomes `this.#scroll.drop()`; `updated()`'s `#chaseScrollTarget(model.rowCount)` becomes `this.#scroll.chase(model.rowCount)`.
- [ ] **Step 3: Run** `pnpm --filter argus-table exec vitest run src/saved-state.test.ts src/scroll-api.test.ts src/auto-row-height.test.ts src/scroll-scaling.test.ts src/column-virtualization.test.ts`. Expected: PASS.
- [ ] **Step 4: Update `CLAUDE.md`** Saved state: "`#restore()`" → "`restore()` (`state-events.ts`)", "becomes `#scrollTarget`" → "becomes `ScrollTarget`'s pending row (`controllers/scroll-target.ts`)".
- [ ] **Step 5: Verify**, commit `refactor: move scrolling to rows, columns and restored positions out of argus-table.ts`, changeset `split-argus-table-5.md`, PR `refactor/split-element-5`, merge when green.

## PR 6: render inputs and plugin-host helpers

### Task 4: `virtual-config.ts`, `render/body-state.ts`, `plugin-host.ts`

**Files:**

- Create: `packages/table/src/controllers/virtual-config.ts`, `packages/table/src/render/body-state.ts`, `packages/table/src/plugin-host.ts`
- Modify: `packages/table/src/argus-table.ts` (`willUpdate` 1293–1340; `#loading` 1599–1625 and `#onRetry` stays; `#toggles` 1877–1893 and `#onToggle` stays; `#pluginHost.header` / `headerText` 721–737; `#columnInfo` 1963–1989)
- Test: existing `argus-table.test.ts`, `detail-rows.test.ts`, `auto-row-height.test.ts`, `plugins.test.ts`, `labels.test.ts`

**Interfaces:**

- Produces:
  - `export interface LaidOut { order: object; display: object; token: object }` and `virtualConfig<T>(model: TableModel<T, CellContent>, previous: LaidOut | undefined, nav: NavigationController<T>, rowPx: number, aroundPx: number, measuring: boolean, auto: boolean, details: boolean, overscan: number): [VirtualConfig, LaidOut]` (a tuple, so no named keys survive minification). Same `keepTop`, token, `rowIdAt`, `positionOf`, `keep` as today; `overscan` passed already clamped.
  - `loadingState<T>(cache: PageCache<T>, window: VirtualWindow, model: TableModel<T, CellContent>, labels: TableLabels, onRetry: (event: Event) => void): Loading`; the element keeps `this.#data.rows ? loadingState(…) : undefined`.
  - `rowToggles<T>(model: TableModel<T, CellContent>, window: VirtualWindow, labels: TableLabels, onToggle: (event: Event) => void): RowToggles`.
  - `columnInfoOf<T>(view: ColumnView<T, CellContent> | undefined, columnFilter: ColumnFilter | undefined): ColumnInfo | undefined` (the element keeps the `#columnsById` index and calls it), `pluginHeader(def: ColumnDef<unknown, unknown> | ColumnGroup<unknown>): unknown` and `pluginHeaderText(def: …same): string` (the bodies of the host's `header` / `headerText`; use the types those members have in `PluginHost`).

- [ ] **Step 1: Move** the four pieces; `willUpdate` calls `const [config, laidOut] = virtualConfig(…); this.#laidOut = laidOut; this.#virtual.configure(config);`.
- [ ] **Step 2: Run** `pnpm --filter argus-table exec vitest run src/argus-table.test.ts src/detail-rows.test.ts src/auto-row-height.test.ts src/plugins.test.ts src/labels.test.ts src/column-groups.test.ts`. Expected: PASS.
- [ ] **Step 3: Verify**; also check `wc -l packages/table/src/argus-table.ts` is about 1,600 (report the number).
- [ ] **Step 4: Commit** `refactor: move the virtualizer setup, body state and plugin helpers out of argus-table.ts`, changeset `split-argus-table-6.md`, PR `refactor/split-element-6` with the series' totals (lines 2,073 → n, CDN 46.11 → n kB), merge when green.

## PR 7: core model types and column views

### Task 5: pin memo identities, then move the types

**Files:**

- Create: `packages/core/src/table/model-types.ts`
- Modify: `packages/core/src/table/create-table.ts` (lines 41–430), `packages/core/src/index.ts`, `packages/table/src/controllers/table-controller.ts` (imports)
- Test: `packages/core/src/table/create-table.test.ts`

**Interfaces:**

- Produces: `model-types.ts` exporting everything lines 41–430 export today (`SortDirection`, `SELECTION_COLUMN_ID`, `SELECTION_COLUMN_WIDTH`, `EXPAND_COLUMN_ID`, `EXPAND_COLUMN_WIDTH`, `ColumnView`, `RowView`, `RemoteRows`, `TableModelOptions`, `TableModel`, and any other export in that range). `create-table.ts` re-exports them (`export * from './model-types.js'`), so no importer has to change; `index.ts` stays as is.

- [ ] **Step 1: Write identity tests** in `create-table.test.ts`, `describe('createTableModel: identities')`:
  - `it('keeps allColumns while nothing changes')`: `expect(m.allColumns).toBe(m.allColumns)`.
  - `it('keeps rowOrder and display across an update that only resizes')`: `update({ columnSizing: { name: 120 } })` → `rowOrder` and `display` `toBe` before; `columns` `not.toBe`.
  - `it('keeps rowOrder when only pinning or visibility change')`: `update({ columnPinning: { name: 'start' } })` → `rowOrder` `toBe` before; `update({ columnVisibility: { age: false } })` → `rowOrder` changes only with a quick filter set (assert both cases).
  - `it('keeps headerGroups across a resize of a column outside any group')`.
  - `it('keeps display for a remote with an unchanged version')`: a `RemoteRows` stub with `version: 1`, two reads `toBe`.
    Run on `main`: `pnpm --filter @argus-table/core exec vitest run src/table/create-table.test.ts -t identities`. Expected: PASS (if one fails, today's behaviour differs from the assertion: fix the test to today's behaviour and note it in the PR). Commit `test: pin the model's memo identities`.
- [ ] **Step 2: Move** the types; run `pnpm nx run-many -t typecheck test -p core argus-table`. Expected: PASS. Commit `refactor(core): move the model's types out of create-table.ts`.

### Task 6: `table/column-views.ts`

**Files:**

- Create: `packages/core/src/table/column-views.ts`
- Modify: `packages/core/src/table/create-table.ts` (`pinOf`, `hiddenOf`, `sizingState`, `widthOf`, `view`, `systemView`, `stretchedWidths`, `buildViews`, `buildAllViews`; 386–431, 452–491, 624–783)

**Interfaces:**

- Produces module-level functions; `Resolved = ResolvedColumn<TData, TContent>`, `Options = TableModelOptions<TData, TContent>`:
  - `pinOf(column: Resolved, pinning: ColumnPinningState | undefined): ColumnPin | undefined`
  - `hiddenOf(column: Resolved, visibility: ColumnVisibilityState | undefined): boolean`
  - `sizingOf(options: Options, resolved: readonly Resolved[]): ColumnSizingState` (uncached; the closure keeps the `sizing` cache)
  - `widthOf(byId: ReadonlyMap<string, Resolved>, sizing: ColumnSizingState, id: string): number`
  - `buildViews(options: Options, byId: ReadonlyMap<string, Resolved>, order: ColumnOrderState, sizing: ColumnSizingState): ColumnView<TData, TContent>[]` (with `view`, `systemView`, `stretchedWidths` as unexported helpers)
  - `buildAllViews(options: Options, byId: …, order: …, sizing: …, shown: readonly ColumnView<TData, TContent>[]): ColumnView<TData, TContent>[]`
    The closure keeps its `pinOf` / `hiddenOf` arrow wrappers with today's defaults (`options.columnPinning`) calling these, so `nextPinning` and the rest read unchanged.

- [ ] **Step 1: Move**; run `pnpm --filter @argus-table/core exec vitest run` and `pnpm --filter argus-table exec vitest run src/stretch-columns.test.ts src/column-state.test.ts`. Expected: PASS.
- [ ] **Step 2: Verify**, commit `refactor(core): move column views out of create-table.ts`, changeset `split-argus-table-7.md`, PR `refactor/split-model-7`, merge when green.

## PR 8: core row pipeline

### Task 7: `table/row-pipeline.ts`

**Files:**

- Create: `packages/core/src/table/row-pipeline.ts`
- Modify: `packages/core/src/table/create-table.ts` (523–622: `all`, `allRows`, `filtered`, `filteredRows`, `sorted`, `rows`, `rowIdOf`, `indexById`, `indexOfId`, `display`, `displayRows`; `expandableAt` and `rowObjectAt` move with them), `CLAUDE.md` ("The row model is core's own" paragraph: name `row-pipeline.ts`)
- Test: existing `create-table.test.ts` (incl. Task 5's identities), `display-rows.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export class RowPipeline<TData, TContent> {
    constructor(
      options: () => TableModelOptions<TData, TContent>,
      byId: () => ReadonlyMap<string, ResolvedColumn<TData, TContent>>,
      predicate: () => RowPredicate<TData> | undefined,
      version: () => number,
    );
    rows(): readonly number[];
    rowId(dataIndex: number): string;
    rowAt(index: number): TData | undefined; // was rowObjectAt
    indexOf(rowId: string): number | undefined;
    expandable(index: number): boolean;
    display(): DisplayRows;
  }
  ```

  Memo state in `#private` fields with today's keys exactly (`all`: data + getRowId; `filtered`: source + test + version; `sorted`: source + sorting + version; `indexById`: rows; `display`: the same key arrays). `RowPredicate` is whatever `rowPredicate()` in `filters/filter.ts` returns (import its type, or `ReturnType<typeof rowPredicate>`).

- [ ] **Step 1: Move**; the returned object's members call the pipeline (`rows()` → `pipeline.rows()`, etc.).
- [ ] **Step 2: Run** `pnpm --filter @argus-table/core exec vitest run`. Expected: PASS, Task 5's identity tests included.
- [ ] **Step 3: Benchmark spot check** in the copy: `ROWS=100000 BROWSERS=chromium RUNS=3 pnpm bench` on this branch and on `main`; p95 and long tasks within noise (±1 ms p95, no new long tasks). Put both in the PR body.
- [ ] **Step 4: Verify**, update `CLAUDE.md`, commit `refactor(core): move the row pipeline out of create-table.ts`, changeset `split-argus-table-8.md`, PR `refactor/split-model-8` with `create-table.ts` 1,059 → n lines and the series' CDN total, merge when green.
- [ ] **Step 5: Update memory** `size-budget-check-before-push.md` with the CDN size after the series.
