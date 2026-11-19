# Tree rows, step 2 (children from a `dataSource`): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With a `dataSource` that has `hasChildren` and `getChildren`, rows can be expanded: a row's children load with one request per expand, with the current sort and filters, at every level, and behave like the client-side tree rows of step 1 (toggle, keys, ARIA, selection, events).

**Architecture:** A new DOM-free core class, `RemoteTree`, wraps the top-level `PageCache` and a per-parent child cache and **implements `RemoteRows`**, so the model keeps reading remote rows through the interface it already uses. It maps the shown order (top-level rows with each open parent's descendants spliced in) to top-level cache indexes with a sorted list of open top-level rows and prefix sums of their shown descendants (binary search, O(log k), like `DisplayRows`). It also answers the tree questions the model and element ask in step 1 (`treeRow`, `nextTreeExpanded`, `shownAncestor`, branch selection), so the element's tree code (toggle, keys, ARIA, focus, selection) works unchanged. The element's `DataController` owns the `RemoteTree`, issues `getChildren` requests (one per parent, aborted on reset), converts the visible range to top-level ranges for `getRows`, and renders loading and failed child rows like failed pages.

**Tech Stack:** Lit 3, TypeScript (strict, `noUncheckedIndexedAccess`, `.js` imports), core's row model (ADR 0010), Vitest (Node for core, browser mode for the table), Playwright, Storybook, Astro docs, Nx, Changesets.

**Spec:** `docs/superpowers/specs/2026-11-18-tree-rows-design.md`, section "Step 2: children from the server" (plus "Public API", "Selection", "Keyboard and accessibility" from step 1). Step 1 is merged (#195); `docs/adr/0013-tree-rows.md` records it.

**Branch:** `feat/tree-rows-server`. One PR into `main`.

**Where to run things:** the mounted repo's `node_modules` hold macOS binaries; run installs, builds and tests in the Linux scratchpad copy (`sync.sh`, then `env.sh`), never `pnpm install` in the mount. ~7 GB RAM: Playwright workers ≤ 3.

## Global Constraints

- Public additions, exactly (ADR 0004: additions only): `DataSource.hasChildren?(row: TData): boolean`, `DataSource.getChildren?(request: ChildrenRequest<TData>): Promise<ChildrenResponse<TData>>`; `ChildrenRequest<TData> { parent: TData; parentId: string; sorting: SortState; filters: ColumnFilterState; quickFilter: string; signal: AbortSignal }` (no range, so `start`/`end` can be added later); `ChildrenResponse<TData> { rows: readonly TData[] }`; `LoadErrorDetail.parentId?: string`; label `retryChildren` (`'Retry loading child rows'`, German `'Untergeordnete Zeilen erneut laden'`).
- A tree from a `dataSource` needs both `hasChildren` and `getChildren`; with either missing, rows are flat as today. `getSubRows`/`getParentId` stay ignored with a `dataSource` (keep the warning, reworded to point at `getChildren`).
- `getRows` keeps returning top-level rows only; its `start`/`end` count top-level rows. The table converts the visible range of the shown order to the top-level rows it covers.
- Every public index stays an index in the current shown order (top-level rows and loaded children of open rows); `argus-range-change` reports shown indexes.
- Default ids: top-level rows as today (`getRowId(row, index)` with the top-level index, else `String(index)`); a child's id is `getRowId(row, indexAmongSiblings)` when set, else `` `${parentId}.${indexAmongSiblings}` ``.
- Children are cached per parent id until a new source, sorting, filters, quick filter, `getRowId`, or `refresh()`; collapsing keeps them. After a reset, open rows' children load again when the parent's row is loaded.
- With a `dataSource`, step 1's "ancestors of matches show open during a filter" doesn't apply: `forced` is always `false`; expansion is `treeExpanded`.
- No new allocation or per-row work for `dataSource` tables without `getChildren`, and none for `data` tables.
- No hard-coded user-visible text; new label with JSDoc and German text in the Labels story and the docs labels example.
- `@fires argus-load-error` JSDoc gains `parentId`; property/`dataSource` JSDoc describes the tree members.
- CDN budget is 52 kB (`packages/table/.size-limit.json`, 51.84 kB on `main`); step 2 will exceed it. The PR states the size and raises the limit only with the owner's approval.
- A changeset per published package changed, written for users.

## Review Focus

1. **A child request that fails, then Retry** (click, and Enter on the failed row): the children show; `argus-load-error` fired once with `parentId` and the parent's `start`/`end`; no duplicate request. Test in task 3.
2. **A late answer from before a reset** (sort changed while a child request is in flight): the late rows are ignored, the new request's rows show. Test in task 3.
3. **`refresh()` with open rows above the view:** the rows in view don't jump while children reload (a parent keeps its previous child count as loading rows until the answer). Test in task 3.
4. **Collapse while the child request is in flight, then expand again:** one request, and its rows show on the expand. Test in task 3.
5. **Children come back empty:** the toggle disappears, no loading row, no `aria-expanded`; `treeExpanded` keeps the id. Test in task 4.

---

### Task 1: Core `RemoteTree`: the shown order over the page cache and loaded children

**Files:**

- Create: `packages/core/src/data/remote-tree.ts`, `packages/core/src/data/remote-tree.test.ts`
- Modify: `packages/core/src/types.ts` (`DataSource`, `ChildrenRequest`, `ChildrenResponse`, `LoadErrorDetail.parentId`), `packages/core/src/table/model-types.ts` (`RemoteRows` optional tree members), `packages/core/src/index.ts`

**Interfaces:**

- Produces (core, exported):

  ```ts
  /** Optional tree members a remote implements to show rows as a tree. */
  export interface RemoteRows<TData> {
    // …existing members…
    /** Changes identity when loaded rows change position (expand, collapse, children loaded); the model's `rowOrder` then returns it. */
    readonly order?: object;
    treeRow?(index: number): TreeRowInfo | undefined;
    /** Whether a row can open: loaded, `hasChildren`, and not known to have no children. */
    canExpand?(rowId: string): boolean;
    shownAncestor?(rowId: string): number | undefined;
  }
  export type ChildState = 'loaded' | 'loading' | 'error';
  export class RemoteTree<TData> implements RemoteRows<TData> {
    constructor(
      cache: PageCache<TData>,
      options: {
        hasChildren: (row: TData) => boolean;
        getRowId?: ((row: TData, index: number) => string) | undefined;
        /** Kept child counts from a previous tree (refresh): open parents show that many loading rows until their children arrive. */
        keepCounts?: ReadonlyMap<string, number> | undefined;
      },
    );
    readonly cache: PageCache<TData>;
    readonly rowCount: number; // shown rows: top-level count + shown descendants
    readonly version: number; // bumped on any change below or in the cache
    readonly order: object;
    entryAt(index: number): { id: string; row: TData } | undefined;
    indexOf(rowId: string): number | undefined;
    loadedIds(): string[]; // loaded shown rows, in order
    stateAt(index: number): RowState; // top-level rows: the cache's; child placeholders: 'loading' | 'error'
    treeRow(index: number): TreeRowInfo | undefined;
    canExpand(rowId: string): boolean;
    shownAncestor(rowId: string): number | undefined;
    /** The top-level index at a shown index, or `undefined` for a descendant. */
    topIndexOf(index: number): number | undefined;
    /** The top-level rows the shown range [start, end) covers, for `getRows` paging. */
    topRange(start: number, end: number): { start: number; end: number };
    /** For a child placeholder or loaded child: its parent's id. */
    parentIdAt(index: number): string | undefined;
    setExpanded(ids: TreeExpandedState): void;
    /** Ids of open, loaded parents whose children are neither loaded nor loading nor failed: to request. */
    wanted(): string[];
    beginChildren(parentId: string): void;
    resolveChildren(parentId: string, rows: readonly TData[]): boolean; // false when not in flight
    failChildren(parentId: string): void;
    retryChildren(parentId: string): void;
    /** Child counts of open parents, for the next tree after `refresh()`. */
    counts(): ReadonlyMap<string, number>;
    childRow(parentId: string): TData | undefined; // the parent row object, for `ChildrenRequest.parent`
  }
  ```

  `TreeRowInfo` as in step 1, with `forced: false` always; top-level `setSize` is the cache's `rowCount` (`-1` while the total isn't known), `posInSet` the top-level index + 1; children among their siblings.

- [ ] **Step 1: Write the failing tests** (`remote-tree.test.ts`, Node; a `PageCache` with page size 4 and rows `{ id, kids }`, `hasChildren: r => r.kids > 0`):
  - `without open rows it is the page cache` — `rowCount`, `entryAt`, `indexOf`, `loadedIds`, `stateAt` equal the cache's; `order` identity stable across a page load.
  - `an open parent shows a loading row until its children arrive` — `setExpanded(['1'])` → `wanted()` is `['1']`; after `beginChildren('1')`: `rowCount` is cache + 1, `stateAt(2)` is `'loading'`, `entryAt(2)` undefined, `parentIdAt(2) === '1'`, `wanted()` empty; after `resolveChildren('1', [a, b])`: rows at 2 and 3 are `'1.0'`, `'1.1'`, row 4 is top-level `'2'`, `treeRow(2)` → `{ depth: 1, parent: 1, setSize: 2, posInSet: 1, hasChildren: …, open: false, forced: false }`, `order` changed identity.
  - `children of children` — open `'1'` and `'1.0'`, resolve both → order `1, 1.0, 1.0.0, 1.0.1, 1.1, 2`.
  - `collapsing hides children and keeps them` — `setExpanded([])` → `rowCount` back; `setExpanded(['1'])` → shown without `wanted()`.
  - `a failed child request shows one error row` — `failChildren('1')` → `stateAt(2) === 'error'`; `retryChildren('1')` → `wanted()` is `['1']` again.
  - `empty children close the row` — resolve with `[]` → no extra row, `canExpand('1') === false`, `treeRow(1).hasChildren === false`.
  - `an open id whose row isn't loaded yet waits` — `setExpanded(['9'])` before page 2 loads → `wanted()` empty; after the page loads it is `['9']`.
  - `topRange covers the top-level rows of a shown range` — with 3 children under `'1'`: `topRange(0, 6)` → `{ start: 0, end: 3 }`.
  - `getRowId names children by their index among siblings`.
  - `keepCounts shows the previous child count as loading rows` — a new tree with `keepCounts: new Map([['1', 3]])`, `'1'` open and loaded → 3 loading rows under it until resolved (Review Focus 3's core part).
  - `stays logarithmic` — 10,000 open top-level rows with 5 children each in a 100k-row cache: 10,000 `entryAt` / `indexOf` calls under 200 ms in Node (guard: generous bound and a 30 s test timeout).

- [ ] **Step 2: Run them to see them fail**
      Run: `pnpm --filter @argus-table/core exec vitest run src/data/remote-tree.test.ts`
      Expected: FAIL (module missing).

- [ ] **Step 3: Implement `RemoteTree`.** Keep a sorted array of open top-level indexes with a prefix-sum array of their shown-descendant counts (rebuilt when expansion or children change, O(k)); a shown index resolves by binary search to a top-level row or to a position inside an open row's flattened subtree (each open top-level row's shown descendants as an array of `{ id, row, depth, parentId, posInSet, setSize, state }`, rebuilt when its subtree changes). Child ids and a `Map<id, location>` for `indexOf`. Top-level ids come from the cache (`cache.indexOf`). Bump `version` and replace `order` on any change; read the cache's `version` so page loads are seen (and an open id whose row just loaded joins `wanted()`).

- [ ] **Step 4: Run** `pnpm nx test core --skip-nx-cache` and `pnpm nx run core:typecheck` — PASS. **Commit**
  ```bash
  git add packages/core/src
  git commit -m "feat(core): remote trees over the page cache"
  ```

### Task 2: Remote trees in the model

**Files:**

- Modify: `packages/core/src/table/create-table.ts`, `packages/core/src/table/row-pipeline.ts` (the warning text), `packages/core/src/table/model-types.ts` (JSDoc)
- Test: `packages/core/src/table/create-table.test.ts` (new `describe('remote tree rows')`)

**Interfaces:**

- Consumes: `RemoteRows` tree members, `RemoteTree` (task 1).
- Produces: with a remote that has `treeRow`: `model.tree === true`; `treeRow`, `shownAncestor` delegate to the remote; `nextTreeExpanded(id, open, base)` uses `remote.canExpand(id)` (unknown or not loaded → `undefined`); `rowOrder` returns `remote.order ?? remote`; `cellContext` (remote branch) adds `depth` when the remote is a tree; branch selection members work over loaded rows (task 5 fills them in; here they return the no-tree answers for remotes). Remote without tree members: unchanged.

- [ ] **Step 1: Write the failing tests:** a model with `remote: new RemoteTree(…)`: `model.tree` true; `treeRow(2).depth === 1`; `cellContext(2, 'name')` has `depth: 1`; `nextTreeExpanded('1', true)` → `['1']`, on a row without `hasChildren` → `undefined`, on an unloaded id → `undefined`; `rowOrder` changes identity when children resolve and stays the same when a page loads; `display` (detail panels) places a panel after a loaded child (`expanded: ['1.0']`). A plain `PageCache` remote: `model.tree === false`, no `depth`.
- [ ] **Step 2: Run, see them fail. Step 3: Implement** (the warning becomes `'argus-table: getSubRows and getParentId are ignored with a dataSource; use its hasChildren and getChildren.'`). **Step 4: Run** core suite and `argus-table:typecheck` — PASS. **Commit** `feat(core): remote tree rows in the model`.

### Task 3: Loading children in the `DataController`

**Files:**

- Modify: `packages/table/src/controllers/data-controller.ts`, `packages/table/src/argus-table.ts` (configure with `treeExpanded`; `request()` with `topRange`; `refresh()`; load errors), `packages/core/src/types.ts` JSDoc for `DataSource` members
- Test: create `packages/table/src/tree-server.test.ts` (reuse the manual-answer server pattern of `argus-table.test.ts` `describe('dataSource (infinite loading)')`: `server()`, `load(el)`, `answer()`; extend it with `getChildren` calls answered by hand)

**Interfaces:**

- Consumes: `RemoteTree` (task 1), model members (task 2).
- Produces: `DataController.rows` is a `RemoteTree` when the source has both `hasChildren` and `getChildren`, else the `PageCache` as today; `DataConfig` gains `treeExpanded: TreeExpandedState`; `stateAt(index)` and `retry(index)` work on shown indexes (a child row retries its parent's children; a top-level row its page); `takeErrors()` entries for children are `{ error, start: parentIndex, end: parentIndex + 1, parentId }`.

- [ ] **Step 1: Write the failing tests** (Review Focus 1–4):
  - `expanding a row requests its children once, with the current sort and filters` — expand `'1'` → one `getChildren` call with `parentId: '1'`, `parent` the row object, `sorting`, `filters`, `quickFilter`, a `signal`; a loading row shows under it (`aria-busy`); answering shows the children; no second call on collapse + expand.
  - `collapse while in flight, expand again` — one call; its rows show after the expand.
  - `a failed child request shows Retry and fires argus-load-error with parentId` — detail `{ error, start: 1, end: 2, parentId: '1' }`; clicking Retry (and Enter on the row) requests again; answering shows the children.
  - `a sort change drops in-flight child requests and reloads open rows` — the old call's `signal` aborted; resolving it late changes nothing; after the first page loads with the new sort, a new `getChildren` for `'1'` (still open) with the new `sorting`.
  - `refresh() keeps open rows' child counts as loading rows` — 3 children loaded under `'1'`, `refresh()` → the rows below keep their positions (the row at shown index 5 is still at the same `aria-rowindex`) while 3 loading rows show, then the new children replace them.
  - `getRows still pages top-level rows` — with 50 children open under row 0 and page size 20, scrolling to shown index 60 requests top-level rows `{ start: 0, end: 20 }` only once and then `{ start: 20, … }` as needed (check `calls`).
  - `children of children load on expand`.
  - `without getChildren nothing changes` — a source with only `hasChildren` is flat; no toggles.
- [ ] **Step 2: Run, see them fail. Step 3: Implement.** In `#load`, after page requests, request `rows.wanted()` children (each with its own `AbortController` kept in a `Map<parentId, AbortController>`, aborted on reset and disconnect; `current()` check as for pages). On a reset that keeps the row count (sorting, `getRowId`, `refresh()`), pass `keepCounts: old.counts()` to the new tree; on a new source or filters, don't. `setExpanded(this.#treeExpanded.value)` on every configure and whenever `treeExpanded` changes (willUpdate). `request(start, end)` in `updated()` converts with `topRange`. JSDoc on `DataSource.hasChildren`/`getChildren`, `ChildrenRequest`, `ChildrenResponse`, `LoadErrorDetail.parentId`, and the `argus-load-error` `@fires`.
- [ ] **Step 4: Run** the file (Chromium, then `BROWSERS=all`), the whole table suite in Chromium, core — PASS. **Commit** `feat(table): load child rows from a data source`.

### Task 4: Rendering, keys and state with remote trees

**Files:**

- Modify: `packages/table/src/render/body-state.ts` (`loadingState` for child rows, `treeRows`), `packages/table/src/render/body.ts` if needed, `packages/table/src/argus-table.ts` (`#onRetry`, `getState`/`setState`, plugin host `rowDepth`), `packages/table/src/labels.ts`, `apps/storybook/stories/labels.stories.ts`, `apps/docs/src/examples/labels/data.ts`
- Test: `packages/table/src/tree-server.test.ts`

**Interfaces:**

- Consumes: tasks 1–3.
- Produces: label `retryChildren`; Retry rows for failed children labelled `retryChildren` (one per failed parent, on its error row); toggles, `aria-level`/`aria-expanded`/`aria-setsize`/`aria-posinset`, Right/Left, focus following a collapse, `rowDepth`, `depth` in contexts and click events — all for loaded remote rows.

- [ ] **Step 1: Write the failing tests:**
  - `loaded remote rows get toggles and tree ARIA` — top-level `aria-setsize` is the total (or `-1` with an unknown total), children `aria-level="2"` with set size/pos among siblings.
  - `Right expands and Left goes to the parent with remote rows`; `collapsing moves focus from a child to the row`.
  - `empty children remove the toggle` (Review Focus 5) — answer `[]` → no toggle, no `aria-expanded`, no loading row, `treeExpanded` still `['1']`.
  - `the failed child row's Retry button is labelled retryChildren`; `labels = { retryChildren: 'Nochmal' }` changes it.
  - `getState/setState carry treeExpanded with a data source` — restoring `treeExpanded: ['1']` requests `'1'`'s children once its page loads.
  - `cell clicks and rowDetail get depth for remote children`; `host.rowDepth(2) === 1`; `host.sourceRow()` stays `undefined`.
  - `scrollToRow({ id })` of a loaded child scrolls to it; of a child under a collapsed row resolves `false`.
- [ ] **Step 2: Run, see them fail. Step 3: Implement** (`loadingState` maps shown indexes: top-level rows through `topIndexOf` for `pageOf` and `retryRows`; child error rows get `retryChildren`). German `'Untergeordnete Zeilen erneut laden'`. **Step 4: Run** the file in all engines, table suite in Chromium, `storybook:typecheck`, `docs:typecheck` — PASS. **Commit** `feat(table): render, keys and state for remote tree rows`.

### Task 5: Branch selection with remote trees

**Files:**

- Modify: `packages/core/src/data/remote-tree.ts` (a loaded forest), `packages/core/src/table/create-table.ts` (branch members for remote trees), `packages/table/src/controllers/selection.ts` (children arriving under a selected row)
- Test: `packages/core/src/data/remote-tree.test.ts`, `packages/table/src/tree-server.test.ts`

**Interfaces:**

- Consumes: core branch rules (`withBranches`, `toggleBranch`, `branchCheck`, `branchCheckAll`, `branchSelectAll`, `BranchTree` with `children`/`allChildren`/`parent`) from step 1; `RemoteTree`.
- Produces: `RemoteTree.forest()` → a structure the model's branch members can run on (rows: loaded top-level rows and loaded children, parent links, depth-first order), memoized on `version`; with remote trees `children === allChildren` (the server filtered); a row with `hasChildren` whose children aren't loaded counts as a leaf for the rules; `SelectionController` adds children that arrive under a selected parent (whole branch selected) through the normal change event, once per arrival.

- [ ] **Step 1: Write the failing tests:** ticking a loaded parent selects it and its loaded children; part-ticked parent when some loaded children are selected; children arriving under a ticked parent are added (one `argus-selection-change`; controlled: proposed, not applied); select-all covers loaded rows (top-level and loaded children); without `selectBranches`, unchanged (loaded shown rows only).
- [ ] **Step 2: Run, see them fail. Step 3: Implement** — reuse the step-1 algorithms over the forest (the `TreeSteps`-like arrays), not copies of them. **Step 4: Run** core and the table selection/tree files in all engines — PASS. **Commit** `feat: branch selection with remote tree rows`.

### Task 6: Wrappers, skills and add-ons

**Files:**

- Modify: wrappers' generated files (regenerate) and hand-written type re-exports in `packages/{react,vue,angular}/src/index.ts` (`ChildrenRequest`, `ChildrenResponse`); `skills/argus-table-integrate` (`scripts/lib/api.mjs`, `references/api.md`, `references/gaps.md`, migrate references for Element Plus `lazy`+`load`, PrimeNG/PrimeVue lazy TreeTable, AG Grid server-side tree data, MUI X lazy loading, `scripts/lib/libraries.mjs` fits: the `lazy-trees` features become `maps`/`partial`, the `lazy-trees` gap goes), `packages/export/README.md` (with `allRows` and a `dataSource`, only top-level rows are exported; without `allRows`, the shown rows including loaded children)
- Test: existing suites

- [ ] **Step 1:** build `argus-table`, regenerate the three wrappers, add the type re-exports; one type check per wrapper that a `dataSource` with `getChildren` typechecks. Run `pnpm nx run-many -t test typecheck lint -p react vue angular` — PASS.
- [ ] **Step 2:** the skill updates (mappings: Element Plus `lazy` + `:load(row, node, resolve)` → `hasChildren` (`hasChildren` field) + `getChildren`; PrimeNG/PrimeVue `lazy` + `onNodeExpand` → same; AG Grid `isServerSideGroup` → `hasChildren`, `getServerSideGroupKey` → the parent id, SSRM child stores → `getChildren` (`partial`: no paged children); MUI X `getChildrenCount` → `hasChildren`, `dataSource.getRows` with `groupKeys` → `getChildren` (`partial`)). Run `pnpm nx test skills`, `pnpm nx run docs:lint` — PASS.
- [ ] **Step 3: Commit** `feat(wrappers): remote tree types; integrate skill: lazy trees are supported`.

### Task 7: Playground, e2e, Storybook and docs

**Files:**

- Modify: `apps/playground/src/main.ts` (`source=remote&tree`: the pretend server answers `getChildren` for every 10th row with 1–5 children, honours sort/filter/latency/`signal`, `failchildren=<id>` fails once), `benchmarks/README.md` if a variant is added
- Create: `tests/e2e/specs/tree-server.spec.ts`; a story `Features/Tree rows` → `FromServer` in `apps/storybook/stories/tree-rows.stories.ts`; docs: a "Children from the server" section in `apps/docs/src/content/docs/features/tree-rows.mdx` (`<Since since="1.5" />` if 1.4 has shipped by then, else part of 1.4 — check `packages/table/package.json` and the pending changesets) with an example `lazy-tree` in four flavours (`apps/docs/src/examples/tree-rows/lazy-tree/{html,react,vue,angular}`), using a pretend server in `apps/docs/src/examples/tree-rows/server.ts`; a line in `infinite-loading.mdx` linking to it.

- [ ] **Step 1:** playground variant. **Step 2:** e2e (all engines): expand by click and Right, children show after the answer, Retry on a failing parent, sort while open reloads children, Ctrl+End. Run `BROWSERS=all … playwright test specs/tree-server.spec.ts --workers=3` — PASS; the whole e2e suite in Chromium — PASS.
- [ ] **Step 3:** story with a play function (expand, loading row, children, axe) and the docs section + examples; `docs:lint`, `docs:typecheck`, `docs:build`, docs e2e for the page in all engines, `storybook:test-storybook` — PASS.
- [ ] **Step 4: Commit** `docs: tree rows from a data source`.

### Task 8: ADR, CLAUDE.md, changesets, size, full check

**Files:**

- Modify: `docs/adr/0013-tree-rows.md` (a "Step 2" section: `RemoteTree` implementing `RemoteRows`, the mapping, the child cache and reset rules, `keepCounts`, `forced` off), `CLAUDE.md` ("Infinite loading" and "Tree rows" paragraphs), `packages/table/.size-limit.json` only with the owner's approval
- Create: `.changeset/tree-rows-server.md` (`argus-table` minor with the wrappers, as the step-1 changeset does)

- [ ] **Step 1:** ADR, CLAUDE.md, changeset. **Step 2:** `pnpm size`; report; ask the owner before raising. **Step 3:** full check (as step 1's task 12: lint, `prettier --check .`, all tests `--skip-nx-cache`, `BROWSERS=all` table tests, Storybook, e2e, skills, examples smoke, `changeset status`). **Step 4: Commit** `docs: tree rows from a data source in ADR 0013; changeset`.

---

## Calls made in this plan (to check)

- **`RemoteTree` implements `RemoteRows`**, so the model and most element code read a remote tree through the interface they already use; tree questions go through optional `RemoteRows` members.
- **A child's default id is `` `${parentId}.${i}` ``** (as nested data in step 1), and `getRowId` gets the index among siblings for children.
- **Children load when an open parent's row is loaded**, not only when it scrolls into view; evicted pages don't drop children (they're small and keep expansion cheap).
- **`refresh()` and a sort change keep each open parent's child count as loading rows** until the new answer, so rows below don't jump; a new source or filter starts over (one loading row).
- **A failed child request is reported as `argus-load-error` with `parentId`**, `start`/`end` being the parent's index and that index + 1 (no new event).
- **Top-level `aria-setsize` is the total row count, `-1` while it isn't known.**
- **Export with `allRows` and a `dataSource` exports top-level rows only**; without `allRows`, the shown rows (loaded children included).
- **Branch selection treats a row whose children aren't loaded as a leaf**, and adds children that arrive under a fully selected parent through the normal change event.
