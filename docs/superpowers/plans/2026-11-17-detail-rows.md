# Detail rows and tables that fit their content: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tables that fit their content up to a maximum height (part 1), then detail panels under body rows, opened with a chevron, holding interactive content such as forms and nested tables (part 2).

**Architecture:** Part 1 is CSS on the scroller plus a guard in the element. Part 2 adds displayed rows to core (data rows plus a panel row after each open one, `DisplayRows`), makes the element's body work in displayed positions internally while every public index stays a data index, renders panel rows from a second row pool, and keeps each open panel's content in a per-row holder that moves between pooled slot elements without changing slot assignment.

**Tech Stack:** Lit 3, TypeScript (strict, `noUncheckedIndexedAccess`), core's own row model (ADR 0010), Vitest browser mode (Chromium, Firefox, WebKit), Playwright, Storybook, Astro docs site, Nx, Changesets.

**Spec:** `docs/superpowers/specs/2026-11-17-detail-rows-design.md` (read it with this plan; it holds the behaviour, the decided API and the anti-goals).

**Branch:** `feat/detail-rows`, on top of `refactor/own-row-model` (PR #179). Part 1 (tasks 1–2) is one PR; part 2 (tasks 3–11) another. Open each against `main` only once #179 is merged (stacked PRs get closed when their base branch is deleted).

**Where to run things:** the repo's `node_modules` may hold another platform's binaries; run builds and tests where the install matches the platform. Commands below are the repo's own (`CLAUDE.md`, "Commands").

## Global Constraints

- Public names, exactly: properties `rowDetail`, `rowExpandable`, `expanded`; event `argus-expanded-change` with `detail: { expanded, rowId, open }`; `TableState.expanded`; tokens `--argus-detail-max-height` (default `400px`), `--argus-detail-bg` (default `var(--argus-bg)`), `--argus-detail-padding` (default the cell padding); parts `row-detail`, `detail`, `row-expanded`, `cell-expand`, `header-cell-expand`, `expand-toggle`; labels `expandRow` = `'Show details'`, `collapseRow` = `'Hide details'` (German: `'Details anzeigen'`, `'Details ausblenden'`).
- Every public index is a data index in the current order: `scrollToRow(index)`, `argus-cell-click` / `argus-row-click` `index`, `argus-range-change` `first`/`last`, range selection, `RowDetailContext.index`, and every `PluginHost` member. Panels never shift them.
- No public type mentions core internals (`DisplayRows`, `ColumnView`, `TableModel`).
- No slot assignment changes while scrolling: pooled rows never switch between data row and panel row, and slot elements created for a pool slot stay rendered.
- A table without `rowDetail` renders no toggle column, no panel rows and allocates nothing for them; `DisplayRows` is the identity.
- No hard-coded user-visible text; every new label in `TableLabels` with JSDoc and German text in the Features/Labels story.
- New controllable state follows `controllable()` and `StateEvents.change()`; its event goes into `StateEvents`' order list.
- `@cssprop`, `@csspart`, `@fires` JSDoc on `ArgusTable` for every new token, part and event (feeds the manifest and the wrappers).
- CDN budget is 42 kB (`packages/table/.size-limit.json`); part 2's PR states the new size and raises the limit only with the maintainer's approval.
- A changeset for every published package changed, written for users.

## Review Focus

1. **A nested `<argus-table>` in a panel:** its arrow keys, Enter, clicks and Shift+clicks must act on the nested table only; today `#onKeydown` takes `composedPath()[0]` and `gridCell()` would accept the nested table's cell, and `#activate` takes the first `role="row"` on the path. Test in task 7.
2. **`expanded` holding ids that can't show a panel** (filtered out, not loaded yet, `rowExpandable` false, unknown, duplicated): no panel, no error, the id stays in `expanded`, and the panel shows once the row can. Test in task 4.
3. **A panel that changes height after it opened** (an image loading, a nested table's data source answering) while the user looks at rows below it: the rows in view don't move. Test in task 6.
4. **`rowDetail` set to `undefined` while panels are open:** the toggle column and all panel rows go, every kept holder is released through the content renderer, `expanded` keeps its ids. Test in task 8.
5. **RTL, sideways scroll and pinned columns together:** the panel stays at the scroller's visible inline start and width. Test in task 8.

---

## Part 1: tables that fit their content

### Task 1: Fit-to-content height with a window-height cap

**Files:**

- Modify: `packages/table/src/styles/base.ts` (the `[part~='table']` rule)
- Modify: `packages/table/src/argus-table.ts` (the guard, in `updated()`; `@cssprop`-free, JSDoc on the class: a paragraph on sizing)
- Create: `packages/table/src/fit-height.test.ts`

**Interfaces:**

- Produces: private CSS variable `--_auto-cap` on the scroller (px, or unset), set by the element; nothing public besides documented CSS behaviour.

- [ ] **Step 1: Write the failing tests** in `fit-height.test.ts` (mount with `document.createElement` and inline styles, not `fixture()`, which sets a height):
  - `it('is as tall as its header and rows when block-size is auto')`: 3 rows, `style="inline-size: 600px; block-size: auto; max-block-size: 360px"`; after `settle()`, `el.getBoundingClientRect().height` equals the header row plus 3 rows (read the row height from a rendered row) within 1 px.
  - `it('stops at max-block-size and virtualizes past it')`: 2,000 rows, same style; host height is 360 within 1 px, and fewer than 30 body rows are rendered (`[part~="body"] > [role="row"]`).
  - `it('grows and shrinks with the data')`: start with 3 rows, set `data` to 5 rows, then 1 row; height follows each time.
  - `it('caps a table without a maximum at the window height, and warns once')`: 2,000 rows, `block-size: auto`, no maximum; host height is `window.innerHeight` within 1 px; `console.warn` was called once with a message starting `argus-table: block-size is auto without a max-block-size`.
  - `it('does not cap a table with an explicit height taller than its rows')`: 3 rows, `block-size: 2000px`; host height is 2000 and no warning.

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter argus-table exec vitest run src/fit-height.test.ts`
Expected: FAIL (an auto-height host collapses or ignores the maximum).

- [ ] **Step 3: Implement**
  - `base.ts`: the scroller keeps `block-size: 100%` and gets `max-block-size: var(--_auto-cap, inherit)`.
  - `argus-table.ts`, in `updated()` after rows are measured: the table is "auto without a maximum" when the host's computed `max-block-size` is `none`, the scroller doesn't overflow, and its height equals the content height (`#headerAndPinnedPx(layout)` plus the body's `totalSize`) within 1 px while that content is taller than `window.innerHeight`. Then set `--_auto-cap` to `${innerHeight}px` and warn once per element: `argus-table: block-size is auto without a max-block-size; capped at the window's height.` Listen to the window's `resize` (added in `connectedCallback`, removed in `disconnectedCallback`) to update the cap. An explicit height never matches (its scroller is taller than its content, or overflows).

- [ ] **Step 4: Run the tests to make sure they pass, in all engines**

Run: `BROWSERS=chromium,firefox,webkit pnpm --filter argus-table exec vitest run src/fit-height.test.ts`
Expected: PASS in all three.

- [ ] **Step 5: Run the whole table suite** (`pnpm nx test argus-table`) and `pnpm --filter argus-table size`: PASS, size under 42 kB.

- [ ] **Step 6: Commit**: `feat: tables that fit their content up to max-block-size`

### Task 2: Docs for fitting the content

**Files:**

- Modify: `apps/storybook/stories/scrolling.stories.ts` (story `FitToContent`, with a play function asserting the host height for 3 rows, then for 2,000 rows)
- Modify: `apps/docs/src/content/docs/features/scrolling.mdx` (section "Fit to content": the CSS, the cap at the window's height, "use a length, not a %")
- Create: `apps/docs/src/examples/scrolling/fit-to-content/{html,react,vue,angular}/…` (follow `apps/docs/src/examples/selection/single/` for file names and shape)
- Modify: `packages/table/README.md` ("Height:" bullet: mention `block-size: auto` with `max-block-size`)
- Modify: `CLAUDE.md` ("Row heights" or a new "Fit to content" paragraph: the `--_auto-cap` guard)
- Create: `.changeset/fit-to-content.md` (`'argus-table': minor`)

- [ ] **Step 1:** Write the story and the four flavours; each flavour shows a table with 4 rows, `block-size: auto; max-block-size: 320px`.
- [ ] **Step 2:** Run `pnpm nx run storybook:test-storybook` (twice after a rebuild) and `pnpm nx run docs:lint docs:typecheck`, then `BROWSERS=chromium pnpm nx run docs:e2e -- --grep scrolling`: PASS.
- [ ] **Step 3:** Write the changeset: tables can fit their rows with `block-size: auto` and a `max-block-size`; without a maximum they stop at the window's height.
- [ ] **Step 4:** `pnpm exec prettier --check .` (in a checkout without a pnpm store inside it) and commit: `docs: fit-to-content tables`. Open part 1's PR once #179 is merged.

## Part 2: detail panels

### Task 3: Displayed rows in core

**Files:**

- Create: `packages/core/src/table/display-rows.ts`
- Create: `packages/core/src/table/display-rows.test.ts`
- Modify: `packages/core/src/index.ts` (export `DisplayRows`, `type DisplayRow`)

**Interfaces:**

- Produces:

  ```ts
  export type DisplayRow = { kind: 'data'; index: number } | { kind: 'detail'; index: number };
  export class DisplayRows {
    /** `count` data rows; `open`: data indexes with a panel after them (any order, duplicates and out-of-range ignored). */
    constructor(count: number, open?: Iterable<number>);
    readonly count: number; // data rows + panels
    readonly dataCount: number;
    readonly open: readonly number[]; // sorted, unique
    at(position: number): DisplayRow | undefined;
    positionOf(index: number): number; // the data row's position
    detailPositionOf(index: number): number | undefined;
    hasDetail(index: number): boolean;
    /** The data rows from `start` to `end` positions, inclusive: first and last data index, or undefined when none. */
    dataRange(start: number, end: number): { first: number; last: number } | undefined;
  }
  ```

  Lookups are O(log k) by binary search over `open` (k open panels); with no panels every method is the identity.

- [ ] **Step 1: Write the failing tests**:
  - `it('is the identity without panels')`: `new DisplayRows(5)`: `count` 5, `at(3)` is `{ kind: 'data', index: 3 }`, `positionOf(3)` 3, `detailPositionOf(3)` undefined.
  - `it('puts a panel after each open row')`: `new DisplayRows(5, [3, 1])`: `count` 7; positions 0..6 are data 0, data 1, detail 1, data 2, data 3, detail 3, data 4; `positionOf(4)` 6; `detailPositionOf(1)` 2.
  - `it('ignores duplicates and indexes out of range')`: `new DisplayRows(3, [1, 1, 7, -1])`: `open` is `[1]`, `count` 4.
  - `it('maps a range of positions to data rows')`: with `[1]` open, `dataRange(2, 3)` is `{ first: 2, last: 2 }` (position 2 is the panel of row 1), `dataRange(2, 2)` is undefined.
  - `it('round-trips every position')`: for 1,000 rows and 50 random open indexes (seeded), `at(positionOf(i))` is `{ kind: 'data', index: i }` for every `i`, and `at(detailPositionOf(i))` is `{ kind: 'detail', index: i }` for every open `i`.
- [ ] **Step 2:** Run `pnpm --filter @argus-table/core exec vitest run src/table/display-rows.test.ts`: FAIL (module missing).
- [ ] **Step 3:** Implement `DisplayRows` in `display-rows.ts`.
- [ ] **Step 4:** Run it again: PASS.
- [ ] **Step 5:** Commit: `feat(core): displayed rows, data rows plus panels`

### Task 4: Expanded state and the toggle column in the core model

**Files:**

- Modify: `packages/core/src/types.ts` (public types)
- Modify: `packages/core/src/table/create-table.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/table/create-table.test.ts` (new `describe('createTableModel: expanded rows')`)

**Interfaces:**

- Consumes: `DisplayRows` (task 3).
- Produces (public, in `types.ts`):
  ```ts
  export type ExpandedState = readonly string[];
  export interface ExpandedChangeDetail {
    expanded: ExpandedState;
    rowId: string;
    open: boolean;
  }
  export interface RowDetailContext<TData> {
    row: TData;
    rowId: string;
    index: number;
  }
  // TableState gains: expanded?: ExpandedState;
  ```
- Produces (core):

  ```ts
  export const EXPAND_COLUMN_ID = '--argus-expand';
  export const EXPAND_COLUMN_WIDTH = 40;
  // ColumnView.kind: 'data' | 'selection' | 'expand'
  // TableModelOptions gains:
  //   detail?: boolean;                        // rowDetail is set: adds the toggle column and panels
  //   expanded?: ExpandedState | undefined;
  //   rowExpandable?: ((row: TData) => boolean) | undefined;
  // TableModel gains:
  //   readonly display: DisplayRows;           // identity unless `detail`; memoized on rowOrder, expanded, rowExpandable, detail, and for remote rows on the loaded rows
  //   expandable(index: number): boolean;      // data index: loaded and rowExpandable allows it (false without `detail`)
  //   nextExpanded(rowId: string, open: boolean, base?: ExpandedState): ExpandedState | undefined; // undefined: no change, or a row that can't expand
  ```

  The toggle column comes after the selection column among the start-pinned columns, shifts `colIndex` and start offsets like it, and stays out of `columns`' order, sizing, `allColumns` and `orderOf()`. An id equal to `EXPAND_COLUMN_ID` in `columns` throws, as the selection id does.

- [ ] **Step 1: Write the failing tests**:
  - `it('adds the toggle column after the selection column')`: with `detail: true, selectionColumn: true`, `columns[0].kind` is `'selection'`, `columns[1]` is `{ id: EXPAND_COLUMN_ID, kind: 'expand', pin: 'start', width: 40 }` (match those fields), and the first start-pinned data column's `offset` is 80.
  - `it('shows panels for expanded rows in the current order')`: 4 people with `getRowId: p => p.id`, `detail: true`, `expanded: ['p3']`, sorted by name; `display.count` is 5 and `display.detailPositionOf(m.indexOf('p3')!)` is `m.indexOf('p3')! + 1`.
  - `it('shows no panel for ids it cannot place')` (Review Focus 2): `expanded: ['p3', 'p3', 'nope', 'p2']` with `rowExpandable: p => p.id !== 'p2'` and a quick filter that drops `p3`: `display.count` equals `rowCount`; clearing the filter brings `p3`'s panel back without changing `expanded`.
  - `it('is the identity without detail')`: `expanded: ['p1']` but no `detail`: `display.count` is `rowCount`, no toggle column.
  - `it('proposes the next expanded state')`: `nextExpanded('p1', true)` is `['p1']`; with `expanded: ['p1']`, `nextExpanded('p1', true)` is undefined and `nextExpanded('p1', false)` is `[]`; `nextExpanded('p2', true)` with `rowExpandable` refusing `p2` is undefined.
  - `it('places panels only for loaded remote rows')`: a remote with rows 0–9 loaded and `expanded` holding the ids of row 3 and an unloaded row 40: `display.open` is `[3]`.
  - `it('keeps display while nothing it reads changes')`: two reads of `display` with an unrelated `columnSizing` update in between return the same object.
- [ ] **Step 2:** Run `pnpm --filter @argus-table/core exec vitest run src/table/create-table.test.ts -t "expanded rows"`: FAIL.
- [ ] **Step 3:** Implement the types, options, `display`, `expandable`, `nextExpanded` and the toggle column view (`expandView`, beside `selectionView`). `display` builds its open list by mapping each `expanded` id through `indexOf` (remote: `remote.indexOf`), keeping those where `expandable(index)`.
- [ ] **Step 4:** Run the core suite (`pnpm nx test core`) and typecheck (`pnpm nx typecheck core`): PASS.
- [ ] **Step 5:** Commit: `feat(core): expanded rows and the toggle column`

### Task 5: The element's API: properties, event, state, labels and the chevron

**Files:**

- Modify: `packages/table/src/argus-table.ts` (properties `rowDetail`, `rowExpandable`, `expanded`; `getState()`/`setState()`; `willUpdate` passes `detail`, `expanded`, `rowExpandable` to the model; JSDoc `@fires argus-expanded-change`, `@csspart cell-expand`, `header-cell-expand`, `expand-toggle`, `row-expanded`)
- Modify: `packages/table/src/events.ts` (`EXPANDED_CHANGE = 'argus-expanded-change'`, `HTMLElementEventMap` entry)
- Modify: `packages/table/src/labels.ts` (`expandRow`, `collapseRow`)
- Modify: `packages/table/src/types.ts` (re-export `ExpandedState`, `ExpandedChangeDetail`, `RowDetailContext` with `TContent` fixed as the others)
- Modify: `packages/table/src/render/body.ts` (the chevron in `kind: 'expand'` cells), `packages/table/src/render/header.ts` (empty `header-cell-expand`), `packages/table/src/render/content.ts` (`cellParts` for `kind: 'expand'`)
- Create: `packages/table/src/detail-rows.test.ts`

**Interfaces:**

- Consumes: task 4's model members and public types.
- Produces:

  ```ts
  // ArgusTable<T>
  rowDetail?: (context: RowDetailContext<T>) => CellContent;   // property only
  rowExpandable?: (row: T) => boolean;                          // property only
  get expanded(): ExpandedState; set expanded(value: ExpandedState | undefined); // controllable
  // private: #toggle(index: number): void  — data index; through StateEvents.change('expanded', …, EXPANDED_CHANGE, [[rowId, { rowId, open }]])
  ```

  The chevron is `<button part="expand-toggle" type="button" tabindex="-1" aria-expanded=… aria-label=… data-row=…>` inside the `cell-expand` cell (the cell holds focus, as the checkbox column's cells do); its click handler must not `preventDefault()`. `aria-controls` is added in task 6, when panel rows exist.

- [ ] **Step 1: Write the failing tests** in `detail-rows.test.ts`:
  - `it('adds the toggle column only with rowDetail')`: without `rowDetail` there's no `[part~="cell-expand"]`; with it, every loaded body row whose `rowExpandable` allows it has one `[part~="expand-toggle"]`, with `aria-expanded="false"` and `aria-label="Show details"`.
  - `it('toggles on a click and fires argus-expanded-change')`: click row 2's chevron; one event with `detail` `{ expanded: [id2], rowId: id2, open: true }` after the update; `el.expanded` is `[id2]`; the button says `aria-expanded="true"`, `aria-label="Hide details"`, and its row has the part `row-expanded`.
  - `it('toggles with Enter and Space on the chevron cell')`: focus row 0's `cell-expand` cell, press Enter, then Space: open, then closed.
  - `it('only proposes when controlled')`: `el.expanded = []`; a click fires `{ expanded: [id], open: true }` and `el.expanded` stays `[]`.
  - `it('saves and restores expanded')`: `getState().expanded` equals `el.expanded`; `setState({ expanded: [id] })` opens it without an event.
  - `it('fires no cell or row click from the chevron')`: clicking the chevron fires no `argus-cell-click` / `argus-row-click` and doesn't select the row with `selectionMode: 'multi'`.
  - `it('translates the chevron')`: `labels: { expandRow: 'Details anzeigen' }` changes the button's name.
- [ ] **Step 2:** Run `pnpm --filter argus-table exec vitest run src/detail-rows.test.ts`: FAIL.
- [ ] **Step 3:** Implement. `expanded` uses `controllable<ExpandedState>([])`; add `EXPANDED_CHANGE` to `StateEvents`' list; the chevron click and the Enter/Space branch in `#onKeydown` (before plugins, like the checkbox column's Space) call `#toggle`. Clicks in the toggle column are skipped by `#activate` and by `SelectionController` as the checkbox column's are.
- [ ] **Step 4:** Run the file, then `pnpm nx test argus-table` and `pnpm nx typecheck argus-table`: PASS.
- [ ] **Step 5:** Commit: `feat: expanded rows, the toggle column and argus-expanded-change`

### Task 6: The body in displayed positions, with panel rows

**Files:**

- Modify: `packages/table/src/grid.ts` (`layoutOf`: body = `model.display.count`; new `dataIndexOf(model, position): number | undefined`, `positionOfIndex(model, index): number`)
- Modify: `packages/table/src/controllers/virtual-controller.ts`
- Modify: `packages/table/src/controllers/row-measure.ts` (no interface change; the element's `bodyIndex` callback returns positions, and `undefined` for data rows when only panels are measured)
- Modify: `packages/table/src/render/body.ts` (panel rows), `packages/table/src/render/cells.ts` (panel slot elements)
- Modify: `packages/table/src/argus-table.ts` (`willUpdate`, `render`, `updated`, `#loading`, `#measureAutoWidths`, range event, data requests)
- Test: `packages/table/src/detail-rows.test.ts`, `packages/table/src/controllers/virtual-controller.test.ts` if it exists, else in `detail-rows.test.ts`

**Interfaces:**

- Consumes: `model.display` (task 4), `DisplayRows.at`, `positionOf`, `detailPositionOf`, `dataRange`.
- Produces:

  ```ts
  // virtual-controller.ts
  export interface WindowRow {
    slot: number;
    index: number; // displayed position
    row: number; // data index (the panel's own row for a panel)
    start: number;
    size?: number | undefined;
    idle?: boolean; // a pool slot kept rendered but unused: hidden, never removed
  }
  export interface VirtualWindow {
    rows: WindowRow[]; // data rows, data pool, in pool order
    details: WindowRow[]; // panel rows, panel pool, in pool order
    totalSize: number;
    range: { start: number; end: number } | null; // displayed positions
  }
  export interface MeasuredRows {
    order: object; // changes when rows at positions may differ
    indexOf: (id: string) => number | undefined; // position of a data row id or a panel id
    all: boolean; // true: every row (rowHeight 'auto'); false: panel rows only
  }
  // VirtualConfig: `auto?: AutoRows` becomes `measure?: MeasuredRows`; adds
  //   isDetail?: (position: number) => boolean;
  //   dataIndexAt?: (position: number) => number;
  ```

  Panel row ids are `` `\u0001detail:${rowId}` `` (a prefix no row id from `getRowId` can collide with in practice; document it in the JSDoc of `rowDetail`). The panel row: `<div part="row-detail" class="row detail-row" role="row" aria-rowindex=…  id=…><div part="detail" role="gridcell" aria-colspan=${columns.length} data-col="--argus-detail" tabindex=…><slot name="d-${slot}"></slot></div></div>`; the chevron gets `aria-controls` pointing at the panel row's `id` (unique per table, from the row id).
  Light DOM: `renderLightDom` gains a `details: readonly WindowRow[]` argument and renders `<div slot="d-${slot}"></div>` for every panel pool slot ever created (idle ones too), keyed by slot. The panel's content isn't rendered here (task 8).

- [ ] **Step 1: Write the failing tests** (panels empty for now: `rowDetail: () => ''`):
  - `it('renders a panel row after each open row')`: open rows 1 and 3 of 20; the body has panel rows with `aria-rowindex` of row 1 plus 1 and row 3 plus 2; the grid's `aria-rowcount` grew by 2; each panel's cell has `aria-colspan` equal to the shown columns.
  - `it('keeps public indexes as data indexes')`: with row 1 open, clicking row 3's cell fires `argus-cell-click` with `index: 3`; `scrollToRow(10)` puts data row 10 at the top; `argus-range-change` reports data rows.
  - `it('measures panels with fixed row heights')`: `rowDetail` returning a 120px-tall `div`; the panel row is 120 px and the next row starts right below it.
  - `it('keeps the rows in view in place when a panel above them grows')` (Review Focus 3): scroll so row 30 is at the top, then grow row 5's panel content by 200 px; after `settle()` row 30 is at the same viewport offset within 1 px.
  - `it('never removes a pooled slot while scrolling')`: open every 3rd row of 500; record the light DOM's `slot` attributes; scroll through 200 rows in steps of 40 px; the set of `slot` attribute values only grows, and no element's `slot` attribute changes (MutationObserver on `attributes` with `attributeFilter: ['slot']` sees nothing after the first render).
  - `it('adds nothing without rowDetail')` (anti-goal): with `expanded: ['p1']` and no `rowDetail`, there are no `[slot^="d-"]` elements in the light DOM, no panel rows, and `aria-rowcount` equals the header rows plus the data rows.
  - `it('shows a panel once its row loads')`: a `dataSource` (50 ms latency) with `expanded` holding row 40's id; no panel while row 40 is unloaded; after scrolling there and the page loading, the panel follows row 40, and the row at the top of the view stays in place within 1 px.
  - `it('keeps the rows in view in place when a panel above them opens from code')`: scroll so row 30 is at the top, set `expanded` to row 5's id; row 30 keeps its viewport offset within 1 px.
  - `it('scrolls to the end of 1M rows with panels open')`: 1,000,000 rows, every 1,000th open, forced small cap (`setMaxElementHeightForTests`); `scrollToRow(999_999)` resolves `true` and the last data row is rendered.
- [ ] **Step 2:** Run `pnpm --filter argus-table exec vitest run src/detail-rows.test.ts`: the new tests FAIL.
- [ ] **Step 3:** Implement:
  - `VirtualController`: `configure()` resets `RowSizes` to `count` positions; heights by id, held corrections and the px grid apply when `measure` is set (either `all` or panels only); a table without panels keeps today's fixed path. `computeWindow()` runs `steadyWindow` over positions, then splits them by `isDetail` into the two pools; each pool returns every slot it ever created, unused ones as `idle`. `scrollToIndex`, `reveal`, `topRow`, `pageRows`, `startOf`, `sizeOf` work in positions.
  - The element converts at the edges: `scrollToRow(index)` → `positionOfIndex`; `topRow` → the data row at or after it (`getState().scroll.row` stays a data index); `#scrollTarget` holds data indexes; `argus-range-change` → `display.dataRange(range.start, range.end)`; `#data.request()` → the data range of the rendered positions; `#loading().stateAt(position)` → `dataIndexOf`; `#measureAutoWidths` reads data rows only.
  - `RowMeasure` runs whenever `rowHeight` is `'auto'` or a panel is open; its `bodyIndex` returns positions, and `undefined` for data rows when only panels are measured.
  - Panel rows' `min-block-size` is at least the row height; `--argus-detail-max-height` caps the `detail` cell (task 8 styles it fully).
- [ ] **Step 4:** Run the file in all engines (`BROWSERS=chromium,firefox,webkit`), then `pnpm nx test argus-table`, `pnpm nx test core`: PASS. Existing tests must pass unchanged.
- [ ] **Step 5:** Commit: `feat: panel rows in the body, positions inside and data indexes outside`

### Task 7: Keyboard, focus, selection and events over panels

**Files:**

- Modify: `packages/table/src/controllers/navigation.ts` (`rowId(model, position)`, `reconcile`, `#verticalStep`, `#pageRows`, `#focus`, `#selectionKey`)
- Modify: `packages/table/src/controllers/selection.ts` (`#rowOf`: data rows of this table only; the controller keeps data indexes)
- Modify: `packages/table/src/argus-table.ts` (`#onKeydown`, `#activate`, `#cellTarget`, plugin host `focusCell`)
- Modify: `packages/table/src/grid.ts` (`gridCell(target, root?)`: only cells whose `getRootNode()` is `root`)
- Test: `packages/table/src/detail-rows.test.ts`

**Interfaces:**

- Consumes: task 6's positions and `dataIndexOf` / `positionOfIndex`.
- Produces: the active cell on a panel is `{ section: 'body', index: <panel position>, rowId: <panel id>, col: '--argus-detail' }`; `PANEL_COLUMN = '--argus-detail'` exported from `grid.ts`. Leaving a panel up or down returns to the column the active cell was on before it entered the panel.

- [ ] **Step 1: Write the failing tests**:
  - `it('arrows down onto an open panel and on to the next row')`: row 2 open; from row 2's name cell, ArrowDown focuses the panel's cell; ArrowDown again focuses row 3's name cell; ArrowUp twice returns to row 2's name cell.
  - `it('enters the panel with Enter or F2 and leaves it with Escape')`: a panel with `<input>`; Enter on the panel cell focuses the input; typing `abc` changes the input's value; Escape focuses the panel cell again; F2 enters again.
  - `it('leaves keys inside a panel to its content')`: with the input focused, ArrowDown, Home, Enter and Space don't move the active cell and fire no table events.
  - `it('keeps a nested table to itself')` (Review Focus 1): a panel holding an `<argus-table>` of 10 rows with `selectionMode: 'multi'`; arrow keys in the nested table move its active cell, not the outer one; a click on a nested row fires `argus-row-click` on the nested table only (none with the outer's `index`), and Shift+click selects in the nested table only.
  - `it('fires no events and selects nothing for clicks inside a panel')`: outer `selectionMode: 'multi'`; clicking the panel's padding and its input fires no `argus-cell-click` / `argus-row-click` and leaves `selection` empty.
  - `it('steps over panels in selection ranges')`: row 2 open; Shift+ArrowDown from row 1 to row 3 (through the panel) selects rows 1–3 by data index; Ctrl/Cmd+A is unchanged.
  - `it('counts panels as rows for PageDown and Ctrl+End')`: Ctrl+End lands on the last data row; PageDown moves focus by the rows (and panels) that fit.
  - `it('keeps a focused panel rendered while it scrolls away')`: focus the input in row 2's panel, scroll the body 5,000 px down; the panel row is still in the DOM and the input still has focus (`el.shadowRoot` / document `activeElement` chain), and scrolling back shows it in place.
  - `it('focusCell takes a data index')`: the plugin host's `focusCell(4, 'name')` with row 2 open focuses data row 4.
- [ ] **Step 2:** Run the file: the new tests FAIL.
- [ ] **Step 3:** Implement. `#onKeydown` and `#activate` ignore targets outside this table's shadow root (`gridCell(origin, this.renderRoot)`, rows with `getRootNode() === this.renderRoot`), and keys whose path passes through a panel's slotted content before reaching the `detail` cell (content keys) except Escape, which focuses the `detail` cell. On the `detail` cell: Enter and F2 focus the first focusable element of the panel's holder (task 8 supplies it; until then the slot element), ArrowLeft/Right do nothing.
- [ ] **Step 4:** Run the file in all engines, then `pnpm nx test argus-table`: PASS.
- [ ] **Step 5:** Commit: `feat: keyboard, focus, selection and events with panel rows`

### Task 8: Panel content, kept across scrolling, and its styles

**Files:**

- Create: `packages/table/src/render/detail-content.ts`
- Modify: `packages/table/src/argus-table.ts` (own a `DetailContent`, sync it in `updated()` before measuring; release on disconnect; JSDoc `@cssprop --argus-detail-max-height`, `--argus-detail-bg`, `--argus-detail-padding`, `@csspart row-detail`, `detail`)
- Modify: `packages/table/src/styles/base.ts` (panel row and cell)
- Modify: `packages/table/.size-limit.json` only with the maintainer's approval
- Test: `packages/table/src/detail-rows.test.ts`

**Interfaces:**

- Consumes: `rowDetail`, the window's `details` (task 6), `content()` and `flushContent()` (`render/content-directive.ts`).
- Produces:

  ```ts
  export class DetailContent<T> {
    constructor(host: HTMLElement);
    /**
     * Renders each rendered panel's content into its holder (one Lit root per row id,
     * `render(html\`${content(detail(context))}\`, holder, { host })`), moves the holder into
     * its pool slot's `div[slot="d-…"]` when it isn't already there, and releases the
     * holders of rows in neither `open` nor `rendered`.
     */
    sync(
      detail: ((context: RowDetailContext<T>) => CellContent) | undefined,
      open: ReadonlySet<string>,
      rendered: readonly {
        rowId: string;
        slotElement: HTMLElement;
        context: RowDetailContext<T>;
      }[],
    ): void;
    /** The first focusable element in a row's panel, for Enter/F2 (task 7). */
    firstFocusable(rowId: string): HTMLElement | undefined;
    /** Disconnects every holder's part (framework content released), as on table disconnect. */
    setConnected(connected: boolean): void;
  }
  ```

  A holder is `<div class="argus-detail-content">`; panels out of the window keep their holder detached (its part stays connected, so React, Vue and Angular content stays mounted); `rowDetail` runs only for rendered panels, every update.

- [ ] **Step 1: Write the failing tests**:
  - `it('renders rowDetail into the panel')`: `rowDetail: ({ row, index }) => html\`<p>${row.name} at ${index}</p>\``; the open panel's slotted content reads `Person 2 at 2`; after sorting descending it reads the new index.
  - `it('keeps typed input while the panel scrolls away and back')`: type into the panel's input, scroll 2,000 px down and back; the same `HTMLInputElement` is in the panel with its value.
  - `it('keeps a nested table's sort and scroll across updates')`: a panel returning a Lit template with a nested `<argus-table>`; sort the nested table, set the outer `data` to new objects with the same ids; the nested table is the same element and still sorted.
  - `it('releases framework content when a panel closes')`: a fake `contentRenderer` (records `render`/`release`) and `rowDetail` returning `{ foreign: true }`; closing the panel calls `release` once for its target; closing doesn't release other panels.
  - `it('drops everything when rowDetail goes away')` (Review Focus 4): two panels open, set `rowDetail = undefined`; no toggle column, no panel rows, `release` called for both targets, `el.expanded` unchanged.
  - `it('stays in view when scrolled sideways, also in RTL')` (Review Focus 5): 30 columns with 2 pinned at the start, a panel open, `scrollLeft` (and in RTL the negative offset) at half the scroll width; the `detail` cell's rect spans the scroller's client width from its inline start within 1 px, in LTR and with `dir="rtl"`.
  - `it('spans every column with virtualizeColumns')`: 60 columns, `virtualizeColumns: true`, a panel open; the `detail` cell's `aria-colspan` is 60 plus the toggle column, not the rendered columns' count, and it spans the visible width.
  - `it('caps a panel at --argus-detail-max-height')`: content 1,000 px tall; the `detail` cell is 400 px and scrolls; with `--argus-detail-max-height: 200px` on the table it's 200 px.
- [ ] **Step 2:** Run the file: FAIL.
- [ ] **Step 3:** Implement `DetailContent` and the styles: the `detail` cell is `position: sticky; inset-inline-start: 0`, as wide as the scroller's client width (a private `--_view-w` the element sets from the scroller's `clientWidth`, as the pin shadows are sized), `max-block-size: var(--argus-detail-max-height, 400px)`, `overflow: auto`, `background: var(--argus-detail-bg, var(--argus-bg, Canvas))`, `padding: var(--argus-detail-padding, …)` with the cell padding as fallback, and `min-block-size` the row height.
- [ ] **Step 4:** Run the file in all engines, `pnpm nx test argus-table`, `pnpm nx build argus-table` and `pnpm --filter argus-table size`. If over 42 kB, trim first; then report the size in the PR and ask before raising the limit.
- [ ] **Step 5:** Commit: `feat: panel content kept per row, and panel styles`

### Task 9: Wrappers

**Files:**

- Modify: `tools/generate-wrappers/src/react.ts`, `vue.ts`, `angular.ts` (`CONTENT_PROPS` / `CONTENT_INPUTS`: `rowDetail`), and their tests
- Regenerate: `packages/{react,vue,angular}/src/generated/elements.ts` (`pnpm nx build argus-table`, then `pnpm --filter @argus-table/<name> generate`)
- Modify: `packages/react/src/content.tsx` (type `ReactRowDetail<T> = (context: RowDetailContext<T>) => ReactCellContent`), `packages/react/src/index.ts`
- Modify: `packages/vue/src/define.ts` / `content.ts` (`#detail` slot → `rowDetail`, rendered through `ArgusSlot`), `packages/vue/src/index.ts`, `packages/vue/src/test/Declarative.vue` (a `#detail` slot and a `@vue-expect-error` for a wrongly typed slot prop)
- Modify: `packages/angular/src/content.ts` (`ArgusDetailDirective`, selector `ng-template[argusDetail]`, context `RowDetailContext<T>` as `$implicit`; `ArgusTableBase` maps it to `rowDetail`), `packages/angular/src/index.ts`, `packages/angular/src/test/types.ts`
- Test: `packages/react/src/content.test.tsx`, `packages/vue/src/content.test.ts`, `packages/angular/src/content.test.ts`
- Create: `.changeset/detail-rows-wrappers.md` (`@argus-table/react`, `@argus-table/vue`, `@argus-table/angular`: `minor`)

**Interfaces:**

- Consumes: `rowDetail`, `RowDetailContext`, `argus-expanded-change` (generated as `onExpandedChange` / `@expanded-change` with `v-model:expanded` / `(expandedChange)` with `[(expanded)]` by the existing naming rule).

- [ ] **Step 1: Write the failing tests**, one per wrapper: `it('renders rowDetail content and keeps its state across scrolling')`: a component with a counter (`useState` / `ref` / signal) in the panel; click it twice, scroll the outer table 2,000 px away and back; the counter shows 2. Plus `it('binds expanded two-way')` per wrapper.
- [ ] **Step 2:** Run `pnpm nx test react vue angular`: FAIL.
- [ ] **Step 3:** Implement the generator entries, regenerate, and the per-wrapper mapping.
- [ ] **Step 4:** Run `pnpm nx run-many -t lint typecheck test -p generate-wrappers react vue angular`: PASS (lint fails on a stale generated file).
- [ ] **Step 5:** Commit: `feat(wrappers): rowDetail content and expanded binding`

### Task 10: Stories, docs page, e2e and the benchmark variant

**Files:**

- Create: `apps/storybook/stories/detail-rows.stories.ts` (stories `Basic`, `Form`, `NestedTable`, `Controlled`, `RightToLeft`, each with a play function; axe runs on all)
- Modify: `apps/storybook/stories/labels.stories.ts` (German `expandRow`, `collapseRow`)
- Modify: `apps/docs/src/lib/old-urls.ts` (`STORYBOOK_PAGES`: the new story title)
- Create: `apps/docs/src/content/docs/features/detail-rows.mdx` (frontmatter `since` the next minor of `argus-table`)
- Create: `apps/docs/src/examples/detail-rows/{basic,form,nested-table}/{html,react,vue,angular}/…`
- Create: `tests/e2e/specs/detail-rows.spec.ts`
- Modify: `apps/playground/src/main.ts` (`detail=<n>`: `rowDetail` renders a small form and a 5-row nested table; every `n`th row id is in `expanded`)
- Modify: `benchmarks/README.md` (the `detail=100` variant)

- [ ] **Step 1:** Write the e2e spec: open a panel by click and by keyboard, type, scroll away and back (value kept), sort with panels open (panel follows its row), `?rows=1000000&detail=1000` reaches the last row with `scrollToRow`, RTL; in all three engines.
- [ ] **Step 2:** Run `pnpm nx build playground` then `BROWSERS=all pnpm nx run e2e:e2e -- specs/detail-rows.spec.ts`: PASS.
- [ ] **Step 3:** Write the stories and the docs page with its four-flavour examples; run `pnpm nx run storybook:test-storybook` (twice) and `pnpm nx run-many -t lint typecheck -p docs` and `BROWSERS=all pnpm nx run docs:e2e -- --workers=3 --grep detail`: PASS.
- [ ] **Step 4:** Benchmark: `VARIANTS="detail=,detail=100" ROWS=100000,1000000 BROWSERS=chromium,firefox,webkit RUNS=3 pnpm bench`; both variants pass the gate, and `detail=` matches `main` within noise. Put the table in the part 2 PR.
- [ ] **Step 5:** Commit: `docs: detail rows stories, docs page, e2e and benchmark variant`

### Task 11: Integrate skill, ADR 0011, CLAUDE.md and changeset

**Files:**

- Modify: `skills/argus-table-integrate/scripts/lib/api.mjs` (properties `rowDetail`, `rowExpandable`, `expanded`; event `argus-expanded-change`; the state key), `references/api.md`
- Modify: `skills/argus-table-integrate/scripts/lib/libraries.mjs` (every `{ gap: 'master-detail' }` feature becomes a fit, matching its row in the migrate guide; drop `'master-detail'` from `HARD_GAPS` and the gap list)
- Modify: `skills/argus-table-integrate/references/gaps.md` (remove `## master-detail`), `references/migrate/*.md` (the master/detail rows: how to map each library's API to `rowDetail` / `expanded`)
- Create: `docs/adr/0011-displayed-rows.md` (displayed positions inside, data indexes outside; two pools; panels kept per row id; what tree data and grouping reuse) and its line in `docs/adr/README.md`
- Modify: `CLAUDE.md` (a "Detail rows" architecture paragraph: `DisplayRows`, positions vs data indexes, the two pools and idle slots, `DetailContent`; the "Pooled rows" paragraph's "DOM order is pool order" covers panels)
- Create: `.changeset/detail-rows.md` (`'argus-table': minor`)

- [ ] **Step 1:** Update the skill's API list and migration data; run `pnpm nx test skills`: PASS (it checks the API against the built manifest, so build `argus-table` first, which Nx does).
- [ ] **Step 2:** Write ADR 0011, the `CLAUDE.md` paragraph and the changeset.
- [ ] **Step 3:** Full check: `pnpm lint`, `pnpm test`, `BROWSERS=firefox,webkit pnpm nx test argus-table`, `pnpm --filter argus-table size`, `pnpm exec prettier --check .`: PASS.
- [ ] **Step 4:** Commit: `docs: ADR 0011, the integrate skill and the changeset for detail rows`. Open part 2's PR with the size and benchmark tables.
