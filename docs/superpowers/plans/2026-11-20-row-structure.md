# Row structure refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One internal `RowStructure` in core that flat rows, client trees, flat data sources and data-source trees implement, so the table package stops reaching into `RemoteTree`, and row grouping (local and remote) can land later as a new structure without touching keyboard, navigation, selection or body state.

**Architecture:** Core gets `table/row-structure.ts` (the interface, `LocalRows` over `RowPipeline`, `PagedRows` over a minimal `RemoteRows`, the plain stand-in id helpers); `RemoteTree` implements the interface itself. The model picks one structure and its tree members delegate to it; new model members (`stateAt`, `idAt`, `standIn`, `parentAt`, `depthAt`, `toggleId`) replace the table's direct `RemoteTree` reads. Behaviour, public API and DOM are unchanged.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Lit 3, Vitest (core in Node, table in browser mode), pnpm + Nx.

**Spec:** `docs/superpowers/specs/2026-11-20-row-structure-design.md`

## Global Constraints

- No public API change: properties, methods, events and details, parts, tokens, slots, ARIA, `PluginHost` members, rendered DOM. `pnpm --filter @argus-table/react generate` (and vue, angular) produce identical files.
- Existing tests pass **unchanged** after every task (only an import path may change). New tests are additions.
- CDN bundle stays within `packages/table/.size-limit.json`'s 56 kB (55.69 kB at `7cbe470`); no raise. Every PR states `pnpm size` before and after.
- Hot paths get no more expensive: `stateAt` / `treeRow` per rendered row, `rowIdAt` per window row, `cellContext` per cell. No new allocation per call; `idAt` must not build a `RowView`.
- `model.rowOrder` keeps its identity in exactly today's cases.
- Core stays DOM-free. Interface members are public names (survive minification): don't add members beyond the ones below.
- Repo conventions: `.js` import extensions, `import type`, comments that say why, a changeset for `argus-table` per PR (`patch`, "Internal: …" wording is fine for a refactor: no user-visible change).
- Where to run: the mounted repo's `node_modules` are macOS binaries. Run every command in the Linux scratch copy (`$COPY`: rsync of the repo without `node_modules`, `dist`, `.nx`; `pnpm install --frozen-lockfile` once), edit in the repo, rsync before each run. Prettier from the repo root on changed files only.

## Review Focus

1. **A focused unloaded row in a data-source tree while rows load above it** keeps focus and its place (stand-in ids `\u0000t…` / `\u0000c…` round-trip through `standIn`). Pinned by the contract test in Task 2 and existing `tree-server.test.ts`.
2. **Closing a `treeExpanded` id whose row isn't loaded** (data-source tree) still works, and a controlled host's ids for rows a filter hides are still accepted (`mayToggle`'s two rules). Contract test in Task 2.
3. **`getRowId` set on a flat data source**: stand-in ids are reserved (`\u0000<index>`), not plain indexes, so they can't collide with real ids. Contract test in Task 2.
4. **The test stubs of `RemoteRows`** (four members, `create-table.test.ts` lines 886, 965, 1063, 1797) still typecheck and behave: `tree` false, `stateAt` `'loaded'` for entries, no warning beyond today's.
5. **A Retry on a failed children row vs. a failed page** keeps its label (`retryChildren` vs `retryRows`), now decided via `DataController.pageAt`. Existing `tree-server.test.ts` covers it; Task 4 runs it.

---

### Task 1: One toggle path for `expanded` and `treeExpanded` (PR 1)

**Files:**

- Modify: `packages/table/src/argus-table.ts` (`#toggle` ~1651–1660, `#toggleTree` ~1668–1681)
- Create: `.changeset/<name>.md`

**Interfaces:**

- Produces: `#requestExpanded(name: 'expanded' | 'treeExpanded', state: Controllable<readonly string[]>, event: typeof EXPANDED_CHANGE | typeof TREE_EXPANDED_CHANGE, id: string, next: (id: string, open: boolean, base: readonly string[]) => readonly string[] | undefined): void`: computes `open = !state.value.includes(id)`, calls `next(id, open, state.value)`, and on a value calls `this.#events.change(name, state, value, event, [[id, { rowId: id, open }]])`.

- [ ] **Step 1:** Run the baseline: `pnpm --filter argus-table exec vitest run src/detail-rows.test.ts src/tree-rows.test.ts src/tree-server.test.ts src/saved-state.test.ts` in `$COPY`. Expected: PASS. Run `pnpm nx build argus-table && pnpm size` and note the CDN size.
- [ ] **Step 2:** Add `#requestExpanded`; `#toggle(index)` becomes: id from `model.rowAt(index)?.id`, return if undefined, then `#requestExpanded('expanded', this.#expanded, EXPANDED_CHANGE, id, (i, o, b) => model.nextExpanded(i, o, b))`. `#toggleTree(index)` keeps its `forced` guard (it moves to core in Task 3) and calls `#requestExpanded('treeExpanded', …, model.nextTreeExpanded)`. Keep both methods' JSDoc (merge the "from the latest requested value" comment into `#requestExpanded`).
- [ ] **Step 3:** Rerun Step 1's tests. Expected: PASS, unchanged. `pnpm size`: not larger than Step 1.
- [ ] **Step 4:** `pnpm nx run-many -t lint typecheck -p argus-table`. Expected: no errors.
- [ ] **Step 5:** Changeset (`argus-table: patch`, "Internal refactor of row expansion; no change in behaviour."), commit `refactor: one toggle path for expanded and treeExpanded`, open PR 1 with the size before/after.

---

### Task 2: `RowStructure` and its implementations in core, with a contract suite (PR 2, part 1)

**Files:**

- Create: `packages/core/src/table/row-structure.ts`
- Create: `packages/core/src/table/row-structure.test.ts`
- Modify: `packages/core/src/table/model-types.ts` (`RemoteRows`, 149–203)
- Modify: `packages/core/src/data/remote-tree.ts` (implements the interface)
- Modify: `packages/core/src/index.ts` (export the new types if `argus-table` needs them; `RemoteForest` stays exported)

**Interfaces:**

- Produces, in `row-structure.ts`:

```ts
/** A stand-in id's row: `same` false when the row is gone and `index` is a replacement; `moves` when rows loading above can move it (a data-source tree). */
export interface StandIn { index: number; same: boolean; moves: boolean }

/** How the shown rows (shown indexes) are arranged. */
export interface RowStructure {
  readonly tree: boolean;
  stateAt(index: number): RowState;
  /** A loaded row's id, without building a `RowView`; `undefined` when not loaded or out of range. */
  idAt(index: number): string | undefined;
  /** The stand-in id of a row not loaded. */
  standInId(index: number): string;
  /** The row a stand-in id holds; `undefined` for any other id. */
  standIn(id: string): StandIn | undefined;
  /** The parent's shown index (loaded rows and placeholders); `undefined` at the top level or without a tree. */
  parentAt(index: number): number | undefined;
  treeRow(index: number): TreeRowInfo | undefined;
  /** Depth of a row, loaded or not; `undefined` without a tree or out of range. */
  depthAt(index: number): number | undefined;
  /** The id a click on this row's tree toggle changes: loaded, a tree row, not `forced`. */
  toggleId(index: number): string | undefined;
  /** Whether `treeExpanded` may gain (`open`) or lose this id: today's `nextTreeExpanded` `ok` rule. */
  mayToggle(rowId: string, open: boolean): boolean;
  shownAncestor(rowId: string): number | undefined;
  /** The forest branch selection runs on, and the forest row at a shown index. */
  forest(): TreeForest | undefined;
  forestRow(index: number): number | undefined;
}

export function plainStandInId(index: number, reserved: boolean): string; // `\u0000${index}` or `${index}`
export function plainStandIn(id: string, reserved: boolean): StandIn | undefined; // navigation.ts:557–558's rule, moves: false

export class PagedRows<TData> implements RowStructure; // constructor(remote: RemoteRows<TData>, reserved: boolean); flat
export class LocalRows<TData, TContent> implements RowStructure; // Task 3
```

- `RemoteRows<TData>`: remove `treeRow?`, `depthAt?`, `canExpand?`, `shownAncestor?`, `forest?`; keep `rowCount`, `entryAt`, `indexOf`, `loadedIds`, `version?`, `order?`; add `stateAt?(index: number): RowState` (`PageCache` already has it) and `readonly structure?: RowStructure` (a remote that arranges its rows itself).
- `RemoteTree<TData> implements RemoteRows<TData>, RowStructure`; `get structure() { return this; }`; `tree` is `true`. Its existing `canExpand`, `depthAt`, `shownAncestor`, `forest`, `treeRow`, `stateAt` stay. New on it: `idAt` (`entryAt(i)?.id`), `parentAt` (loaded: `treeRow(i)?.parent`; placeholder: `shownIndexOf(parentIdAt(i))`), `toggleId`, `mayToggle(id, open)` (`!open || canExpand(id)`), `forestRow(i)` (`forest().at(i)`), `standInId` / `standIn` (port `NavigationController.#placeholderId` / `#placeholderRow`, `navigation.ts:513–559`, with `reserved` always true and `moves: true` for the `\u0000t` / `\u0000c` forms). Paging maps and loading bookkeeping stay public and unchanged.
- `PagedRows`: `tree` false; `stateAt` → `remote.stateAt?.(i) ?? 'loaded'`; `idAt` → `remote.entryAt(i)?.id`; stand-ins via the plain helpers with its `reserved`; every tree member `undefined` / `false`.

- [ ] **Step 1: Write the contract suite** in `row-structure.test.ts`: a `describe.each` over fixtures `[name, make(): { s: RowStructure; ... }]` for `PagedRows` (a stub remote like `create-table.test.ts:965`'s, rows at 4 and 5 loaded, `rowCount` 10) and `RemoteTree` (the `setup()` / `open()` pattern of `create-table.test.ts:1842–1868`: tops A(2 kids), B(2), C(0), D(1), page size 4, `rowCount` 6; open `'1'` with B1, B2). `LocalRows` fixtures join in Task 3. Assertions:
  - every fixture: `standIn(standInId(i))` equals `{ index: i, same: true, moves: <fixture's> }` for an unloaded `i`; `standIn('nope')` is `undefined`; `idAt` of a loaded row equals `entryAt(i).id`, of an unloaded row `undefined`.
  - `PagedRows`: `tree` false; `stateAt(4)` `'loaded'`; `treeRow(4)`, `depthAt(4)`, `parentAt(4)`, `toggleId(4)`, `forest()` all `undefined`; `mayToggle('x', true)` false; reserved: `new PagedRows(stub, true).standInId(7)` is `'\u00007'`, unreserved `'7'`.
  - `RemoteTree`: `tree` true; `parentAt(2)` is `1` (B1 under B); with `'3'` expanded and its children begun but not resolved, `stateAt(5)` is `'loading'`, `parentAt(5)` is `4`, `depthAt(5)` is `1`, `standInId(5)` starts with `'\u0000c'` and after `resolveChildren` on an earlier parent above it, `standIn(that id).index` is the row's new index with `same: true, moves: true`; `standInId(6)` (top-level, unloaded page) starts with `'\u0000t'`; `toggleId(1)` is `'1'`, `toggleId(2)` (leaf) `undefined`; `mayToggle('1', false)` true, `mayToggle('2', true)` false (no children), `mayToggle('99', false)` true (closing an unloaded id).
- [ ] **Step 2:** Run `pnpm --filter @argus-table/core exec vitest run src/table/row-structure.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `row-structure.ts` (interface, helpers, `PagedRows`), the `RemoteRows` change and `RemoteTree`'s new members. `create-table.ts` still compiles against the removed optional members: in this step switch its reads to `options.remote?.structure` (`remoteTree()` becomes `options.remote?.structure`), nothing else.
- [ ] **Step 4:** Run the new suite, then all core tests: `pnpm --filter @argus-table/core exec vitest run`. Expected: PASS, existing tests unchanged.
- [ ] **Step 5:** Commit `refactor(core): a row structure interface, PagedRows and RemoteTree as structures`.

---

### Task 3: `LocalRows` and the model delegating to the structure (PR 2, part 2)

**Files:**

- Modify: `packages/core/src/table/row-structure.ts` (add `LocalRows`)
- Modify: `packages/core/src/table/create-table.ts` (95–260, 361–413, 415–417, 530–564)
- Modify: `packages/core/src/table/model-types.ts` (`TableModel`: new members)
- Modify: `packages/core/src/table/row-structure.test.ts` (two more fixtures)
- Modify: `CLAUDE.md` (the "Tree rows" paragraph: `RemoteRows`' optional tree members → `RowStructure`)
- Create: `.changeset/<name>.md`

**Interfaces:**

- Consumes: Task 2's `RowStructure`, `PagedRows`, `plainStandIn*`.
- Produces: `class LocalRows<TData, TContent> implements RowStructure`, `constructor(pipeline: RowPipeline<TData, TContent>, options: () => TableModelOptions<TData, TContent>)`. Its members hold today's local code from `create-table.ts`: `treeRow` (366–385), `mayToggle` (391–395's local `ok`, ignoring `open`), `shownAncestor` (402–413's local part), `forest` (`pipeline.treeSteps()`), `forestRow` (`pipeline.rows()[i]`); `stateAt` → `'loaded'`; `idAt` → `pipeline.rowId(row)` of `rows()[i]`; `depthAt` → `tree.depth[rows()[i]]` or `undefined` without a tree; `parentAt` → `treeRow(i)?.parent`; `toggleId` → the id when `treeRow(i)` exists and isn't `forced`; stand-ins reserved when `options().getRowId` is set; `tree` → `pipeline.tree() !== undefined`.
- Produces on `TableModel` (delegating to `structure()`): `stateAt(index): RowState`, `idAt(index): string` (`s.idAt(i) ?? s.standInId(i)`), `standIn(id): StandIn | undefined`, `parentAt(index)`, `depthAt(index)`, `toggleId(index)`. Existing `tree`, `treeRow`, `shownAncestor`, `nextTreeExpanded` (signature unchanged; `ok` = `structure().mayToggle(id, open)`), `branch*` (through `forest()` / `forestRow()`) delegate. `sourceRow(index)` returns `undefined` when `options.remote` is set.
- In `create-table.ts`: `structure()` returns `options.remote ? (options.remote.structure ?? paged(options.remote)) : local`, `paged` memoized per remote object and `getRowId` presence; `local` created once. `checksFor`'s `!remoteTree()` becomes `!options.remote?.structure`. `cellContext`'s remote branch sets `depth` from `structure().depthAt(i) ?? 0` only when `structure().tree`; its local branch stays as it is (per-cell hot path). `rowAt`, `valueAt`, `rowCount`, `rowOrder`, `selectableIds`, `indexesPassing`, `predicateFor` stay as they are. The "getSubRows … ignored with a dataSource" warning keeps firing exactly once (`pipeline.tree()` is still asked first in `tree`).

- [ ] **Step 1: Write the failing fixtures**: add `LocalRows` flat (`data` of 3 people, no `getRowId`) and `LocalRows` tree (the `create-table.test.ts` tree fixture with a parent A(A1, A2) and B(B1), `treeExpanded: ['A']`) to the `describe.each`, plus their own assertions: flat `tree` false, `depthAt(0)` `undefined`, `stateAt(0)` `'loaded'`, `standInId(5)` `'5'`; tree `parentAt(1)` `0`, `depthAt(1)` `1`, `toggleId(0)` `'A'`, `toggleId(1)` `undefined`, with a filter keeping only `A1` `toggleId(0)` `undefined` (forced) while `mayToggle('A', false)` stays `true`, `shownAncestor('B1')` the index of B (collapsed).
- [ ] **Step 2:** Run the suite. Expected: FAIL (`LocalRows` not exported).
- [ ] **Step 3:** Implement `LocalRows` and the model changes above; delete `remoteTree()`, `forestOf`, `forestRow` closures and the three-way branches they replace.
- [ ] **Step 4:** Add to `create-table.test.ts` (new `it`s only) the identity cases: `rowOrder` is the same object across two `update()`s that change only `columnSizing`, with local rows and with a `RemoteTree` remote; `idAt(i)` equals `rowAt(i).id` for every shown row of the tree fixture.
- [ ] **Step 5:** Run all core tests, then `pnpm --filter argus-table exec vitest run` (table reads core from source). Expected: PASS, existing tests unchanged.
- [ ] **Step 6:** `pnpm nx run-many -t lint typecheck -p core argus-table` and `pnpm nx build argus-table && pnpm size`. Expected: no errors; CDN ≤ 56 kB and noted.
- [ ] **Step 7:** Update CLAUDE.md's tree paragraph (one sentence: the model reads every arrangement through core's `RowStructure`, `table/row-structure.ts`; a remote arranges its own rows through `RemoteRows.structure`). Changeset, commit `refactor(core): LocalRows, and the model reads rows through one structure`, open PR 2 (Tasks 2–3) with size before/after.

---

### Task 4: Body, body state and the element through the model (PR 3)

**Files:**

- Modify: `packages/table/src/render/body-state.ts` (`loadingState` 14–60, `treeRows` 89–104)
- Modify: `packages/table/src/render/body.ts` (`TreeRows` 42–57, `renderRow` 235–237)
- Modify: `packages/table/src/controllers/data-controller.ts` (add `pageAt`, `shownOfTop`)
- Modify: `packages/table/src/argus-table.ts` (`rowDepth` 832–838, `sourceRow` 840, RowMeasure `bodyIndex` 914, `#toggleTree` 1668–1681, the `loadingState(…)` and `treeRows(…)` calls ~1472, ~1485)
- Create: `.changeset/<name>.md`

**Interfaces:**

- Consumes: Task 3's `model.stateAt`, `depthAt`, `toggleId`, `sourceRow`.
- Produces on `DataController<T>`: `pageAt(index: number): number | undefined` (the page of a top-level shown row: `cache.pageOf(tree ? tree.topIndexOf(index) : index)`, `undefined` for children and placeholders); `shownOfTop(top: number): number` (`tree ? tree.positionOfTop(top) ?? tree.rowCount : top`).
- `loadingState(model: TableModel<T, CellContent>, data: DataController<T>, window: VirtualWindow, labels: TableLabels, onRetry: (event: Event) => void): Loading`: states from `model.stateAt`; an error row with `data.pageAt(i) === undefined` gets `labels.retryChildren`; page labels from `data.pageAt` / `data.shownOfTop` / `data.cache`. No `RemoteTree` or `PageCache` import.
- `treeRows(model, labels, onClick): TreeRows | undefined` (no `remote` parameter); `TreeRows.depth` becomes required: `(index: number) => number | undefined` = `model.depthAt`.
- Element: `rowDepth` → `section === 'body' ? (model.depthAt(index) ?? 0) : 0`; `sourceRow` → `model.sourceRow(index)`; `bodyIndex` uses `model.stateAt`; `#toggleTree(index)` → `const id = model.toggleId(index); if (id !== undefined) this.#requestExpanded('treeExpanded', …, id, model.nextTreeExpanded)`.

- [ ] **Step 1:** Run the baseline: `pnpm --filter argus-table exec vitest run src/tree-rows.test.ts src/tree-server.test.ts src/tree-selection.test.ts src/infinite-loading.test.ts src/plugins.test.ts` (use the data-source test file's actual name). Expected: PASS.
- [ ] **Step 2:** Make the changes above.
- [ ] **Step 3:** Rerun Step 1, then the whole table suite `pnpm --filter argus-table exec vitest run`. Expected: PASS, unchanged.
- [ ] **Step 4:** `grep -n "RemoteTree\|PageCache" packages/table/src/render/*.ts`: no matches. Lint, typecheck, build, `pnpm size` (≤ 56 kB, noted).
- [ ] **Step 5:** Changeset, commit `refactor: body and body state read rows through the model`, open PR 3.

---

### Task 5: Keyboard and navigation through the structure; `DataController.tree` removed (PR 4)

**Files:**

- Modify: `packages/table/src/controllers/navigation.ts` (constructor 69–84, `rowId` 484–496, delete `#reserved`, `#placeholderId`, `#placeholderRow` 498–559, `reconcile` 676–695)
- Modify: `packages/table/src/controllers/keyboard.ts` (170, 189–207)
- Modify: `packages/table/src/controllers/data-controller.ts` (delete `get tree` 107–110 and `stateAt` 163–165 if unused)
- Modify: `packages/table/src/argus-table.ts` (the `() => this.#data.tree` argument ~938)
- Modify: `CLAUDE.md` (the Tree rows paragraph's `NavigationController.#placeholderId` sentence → the structure's `standInId` / `standIn`)
- Create: `.changeset/<name>.md`

**Interfaces:**

- Consumes: Task 3's `model.idAt`, `model.standIn`, `model.stateAt`, `model.parentAt`.
- `NavigationController.rowId(model, index)`: if the active cell is a body cell with a `rowId`, `dataIndexOf(model, active.index) === index` and `model.stateAt(index) !== 'loaded'`, return `active.rowId`; else `model.idAt(index)`.
- `reconcile`: `held = found === undefined ? model.standIn(rowId) : undefined`; `held.remote` → `held.moves`; `this.#placeholderId(model, held.index)` → `model.idAt(held.index)`; `ancestor` drops the `model.tree &&` guard.
- `KeyboardRouter`: line 170 `this.#model().stateAt(failed) === 'error'`; `#treeKey`'s `!info` branch: `const parent = towardEnd ? undefined : model.parentAt(index)`.

- [ ] **Step 1:** Run the baseline: `pnpm --filter argus-table exec vitest run src/tree-server.test.ts src/keyboard.test.ts src/navigation.test.ts` (actual names) and record a timing baseline: an ad-hoc Chromium browser test (see the `adhoc-browser-measurements` memory) that mounts a data-source tree of 100 000 top-level rows with 50 rows open, scrolls the body through 200 steps and times each `performUpdate` (wrap it); throw the median and p95 as the result.
- [ ] **Step 2:** Make the changes above. `grep -rn "RemoteTree" packages/table/src --include=*.ts | grep -v test` must show only `data-controller.ts`.
- [ ] **Step 3:** Rerun Step 1's tests (PASS, unchanged) and the timing test: median and p95 within noise of the baseline (≤ 5 % worse; rerun both if not, three runs each).
- [ ] **Step 4:** Whole table suite, `pnpm nx run storybook:test-storybook --skip-nx-cache --output-style=static` (second run counts), `BROWSERS=chromium pnpm nx run e2e:e2e --skip-nx-cache` for the tree and infinite-loading specs. Lint, typecheck, build, `pnpm size`.
- [ ] **Step 5:** Changeset, CLAUDE.md sentence, commit `refactor: navigation and keys read row ids and parents through the model`, open PR 4 with the timing numbers and size.

---

### Task 6: The children-request seam for remote grouping, and the walk-through (PR 5)

**Files:**

- Modify: `packages/table/src/controllers/data-controller.ts` (`#reset` ~226–251, `#fetchChildren` 340–382)
- Create: `.changeset/<name>.md`

**Interfaces:**

- `RemoteTree` already takes `hasChildren` as an option (`RemoteTreeOptions.hasChildren`): that seam exists; nothing to change.
- Produces in `data-controller.ts`: `type LoadChildren<T> = (tree: RemoteTree<T>, parentId: string, signal: AbortSignal, config: DataConfig<T>) => unknown`, and a module function `getChildrenLoader<T>(source: DataSource<T>): LoadChildren<T> | undefined` that builds today's `ChildrenRequest` (`parent: tree.childRow(parentId)`, `parentId`, `sorting`, `filters`, `quickFilter`, `signal`) and calls `source.getChildren`. `#reset` stores `this.#loadChildren = getChildrenLoader(source)` instead of `#getChildren`; the tree is built when `hasChildren` and `#loadChildren` exist; `#fetchChildren` calls `this.#loadChildren(tree, parentId, controller.signal, this.#config)` inside `settle`. Response handling and errors unchanged.

- [ ] **Step 1:** Run `src/tree-server.test.ts`. Expected: PASS.
- [ ] **Step 2:** Make the change.
- [ ] **Step 3:** Rerun; whole table suite. Expected: PASS, unchanged. `pnpm size`.
- [ ] **Step 4:** Write the PR description's walk-through: for each module in the spec's "grouping walk-through" list (`keyboard.ts`, `navigation.ts`, `selection.ts`, `body-state.ts`, `scroll-target.ts`, `data-controller.ts`), state with `file:line` whether grouping would need a change there, and name every remaining branch (expected: selection ranges and click events reading `rowAt`, which the grouping design decides).
- [ ] **Step 5:** Changeset, commit `refactor: one seam for loading a parent's children`, open PR 5.
