# Row grouping, PR 3 (grouping with a `dataSource`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `grouping` works with a `dataSource`: the server groups, counts and totals; top-level groups, the groups inside an open group and the rows inside an open group all load page by page as they scroll into view.

**Architecture:** A new core class `RemoteGroups` (`data/remote-groups.ts`) holds one `PageCache` per level being shown (the root's top-level groups, and each open group's children) and maps shown indexes through the open groups' sizes, recursively. It is both the model's `remote` (`RemoteRows`) and its `RowStructure`, so rendering, keys, ARIA, `treeExpanded`, branch selection and stand-in ids work as they do for local grouping. `DataController` builds it when the effective `grouping` is non-empty, plans page requests per level for the rendered range, and sends `getRows` the `grouping` and the `groupPath` of the level it fills. `RemoteTree` is untouched.

**Tech Stack:** TypeScript (strict), Lit 3, Vitest (Node for core, browser mode for the table), Playwright, Nx, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-20-row-grouping-design.md` ("With a `dataSource`", delivery item 3). PR 1 (#200) and PR 2 (#201) are merged; read ADR 0014 and CLAUDE.md's **Row grouping** and **Tree rows** paragraphs first.

## Global Constraints

- Public API: additions only (ADR 0004). New fields are optional in types apps construct: `RowsRequest.grouping?` and `RowsRequest.groupPath?` (the table always sets both: `[]` without grouping), `RowsResponse.groups?`, `LoadErrorDetail.groupPath?`. New types `GroupPathItem` (`{ columnId: string; value: unknown }`) and `GroupData` (`{ value: unknown; count: number; totals?: Record<string, unknown> }`) in core `types.ts`, re-exported by `argus-table` and the three wrappers.
- `GroupData.count`: data rows under the group, nested levels included (shown as the group's count). A level's size is the response's `total` (groups at upper levels, rows at the deepest); at the deepest level a group's `count` is its rows' total before any page loads.
- Group ids exactly as local grouping: `'\u0000g' + JSON.stringify(path)`, path `[columnId, key, …]` with PR 1's key rules (dates as time, empty values `null`, `Infinity`/bigint as text). Share the function with `group-rows.ts`; never duplicate it.
- Data rows' ids inside groups: `getRowId(row, indexInGroup)`, else `` `${groupId}.${String(indexInGroup)}` ``.
- Grouping with a source that has `hasChildren` and `getChildren` (a data-source tree) stays ignored with one warning; grouping with tree rows (`getSubRows`, `getParentId`) too.
- A response of the wrong kind (`rows` at a group level, or `groups` at the deepest) fails that page like a rejection: shown failed with Retry, `argus-load-error` fired.
- Requests: debounced `LOAD_DEBOUNCE_MS`, aborted when they scroll away (with one page of margin per level), aborted on a reset or disconnect. A new source, sort, filters, quick filter, effective `grouping`, `getRowId` or `refresh()` starts over with nothing carried (open ids stay in `treeExpanded` and reopen as their groups arrive). Closing a group drops its level (reopening loads again).
- Size: CDN limit = measured + at most 0.3 kB, never above `61 kB` (approved). State `pnpm size` before and after in the PR.
- No hard-coded text; no grouping work per row or cell for tables that don't group (read `rows.grouped` once per render, as PR 1).
- Tests in Chromium, Firefox and WebKit for the table; core in Node.

## Review Focus

1. **A server that ignores `grouping`** answers `rows` at the top level: the page fails with `argus-load-error` and a Retry, nothing throws. Test in Task 4.
2. **An open group scrolled far away and back**: its pages are evicted and reload; the group stays open; its own row's page evicted while it is open keeps its rows in place (it shows as a loading row). Test in Task 2.
3. **Sort or filter change with groups open**: everything reloads; the same group ids reopen when their groups arrive. Test in Task 4.
4. **A deepest-level group whose server returns fewer rows than its `count`** (a short page): the level shrinks to what came back and the rows below move up. Test in Task 2.
5. **An upper-level open group before its first page**: one loading row; the active cell on a row below keeps its row (stand-in id) when the page arrives and rows move. Test in Task 3.

---

### Task 1: Request and response types, and the shared group id

**Files:**
- Modify: `packages/core/src/types.ts` (`GroupPathItem`, `GroupData`, `RowsRequest.grouping?` / `groupPath?`, `RowsResponse.groups?`, `LoadErrorDetail.groupPath?`, `DataSource.getRows` JSDoc)
- Modify: `packages/core/src/table/group-rows.ts` (export `groupId(path: readonly unknown[]): string` and `groupingKey(value: unknown): unknown`, used by `buildGroups`), `packages/core/src/index.ts`
- Modify: `packages/core/src/table/create-table.ts` (`checksFor`: a row is a group row when its id starts with `GROUP_ID_PREFIX = '\u0000g'`, exported from `group-rows.ts`; drop `groupsFrom`)
- Modify: `packages/table/src/types.ts`, `packages/{react,vue,angular}/src/index.ts` (re-export `GroupPathItem`, `GroupData`)
- Test: `packages/core/src/table/group-rows.test.ts`, `packages/core/src/table/grouping.test.ts`

**Interfaces:**
- Produces: `groupId(path)`, `groupingKey(value)`, `GROUP_ID_PREFIX`; the types above.

- [ ] **Step 1: Failing tests:** `groupId(['region', 'EU'])` is `'\u0000g["region","EU"]'`; `groupId(['day', groupingKey(new Date(0))])` is `'\u0000g["day",0]'`; `groupingKey('')` and `groupingKey(undefined)` are `null`. The existing local branch-selection tests (`grouping.test.ts`, "selection never holds a group id") still pass with the prefix rule.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/core exec vitest run src/table` — expect the new tests to FAIL.
- [ ] **Step 3: Implement** the exports (move the id building out of `buildGroups`), the types with JSDoc for app developers (the `getRows` JSDoc explains the levels: `groupPath: []` asks for top-level groups; a path one short of `grouping` asks for the groups inside that group; a full path asks for its rows), and the prefix rule in `checksFor`.
- [ ] **Step 4: Run** core tests and `pnpm nx run-many -t typecheck -p core argus-table` — PASS.
- [ ] **Step 5: Commit** `feat(core): request shape and shared ids for grouping with a data source`.

### Task 2: `RemoteGroups`: levels, paging and shown indexes

**Files:**
- Create: `packages/core/src/data/remote-groups.ts`
- Test: `packages/core/src/data/remote-groups.test.ts`

**Interfaces:**
- Consumes: `PageCache`, `groupId`, `groupingKey`, `GroupData`, `GroupPathItem`.
- Produces:
  - `interface RemoteGroupsOptions<TData> { grouping: readonly string[]; pageSize: number; getRowId?: ((row: TData, index: number) => string) | undefined; expanded?: TreeExpandedState }`
  - `interface GroupLevel { readonly key: string /* '' for the root, else the group's id */; readonly path: readonly GroupPathItem[]; readonly groups: boolean /* rows are groups, else data rows */ }`
  - `class RemoteGroups<TData>`:
    - `readonly root: PageCache<unknown>` (the top-level groups: what `DataController.cache` returns, for `totalKnown` and paging state)
    - `rowCount`, `version`, `order` (a new object when loaded rows change position: a group opened or closed, a level's size changed; not when only a page loads)
    - `setExpanded(ids: TreeExpandedState): void` (opening a group whose entry is loaded creates its level: deepest-level groups with `rowCount: count, totalKnown: true`, upper ones with `rowCount: 1, totalKnown: false`; closing drops the level)
    - `ranges(start: number, end: number): { level: GroupLevel; start: number; end: number }[]` (each level the shown range touches, once, with the level-local rows it covers: a level's own rows from the row at (or above) the first position to the one at the last; open groups inside the range recurse with the range clipped to them)
    - `missingPages(level, start, end): number[]`, `begin(level, page): { start: number; end: number }`, `resolve(level, page, response: { rows?: readonly unknown[]; groups?: readonly GroupData[]; total?: number }): 'stored' | 'stale' | 'wrong'` (`'wrong'`: the kind doesn't match `level.groups`; nothing stored, the page stays in flight for `fail`), `fail(level, page): boolean`, `cancel(level, page)`, `retry(index: number): boolean` (the failed page of the row at a shown index), `inFlightOutside(level, start, end): number[]`, `levels(): readonly GroupLevel[]`, `evict(start: number, end: number): void` (levels in view: `evictOutside` their range; levels out of view keep `KEEP_PAGES` pages at the end nearest the view)
    - `pageSpan(index: number): { key: string; start: number; end: number } | undefined` (the failed page holding a shown index: a key unique per level and page, and the shown range of its rows, for Retry labels and `argus-load-error`)
    - `levelOf(index: number): { level: GroupLevel; index: number } | undefined`
  - Every mutation of a level's cache goes through these methods, which bump the version.

- [ ] **Step 1: Failing tests** (`remote-groups.test.ts`, a two-level grouping `['region', 'status']`, page size 2, a helper that answers a level's page with `groups` or `rows`):
  - before anything loads: `rowCount` 1 (one loading row), `stateAt(0)` `'loading'`, `ranges(0, 1)` is the root, local `0…1`;
  - root page `{ groups: [{ value: 'EU', count: 3 }, { value: 'US', count: 2 }], total: 2 }` → `rowCount` 2, `groupAt(0)` `{ id: '\u0000g["region","EU"]', groupColumnId: 'region', value: 'EU', count: 3, depth: 0, totals: {} }`;
  - opening EU (an upper level) shows one loading row under it: `rowCount` 3; its page `{ groups: [Open (2), Done (1)], total: 2 }` → `rowCount` 4, and `ranges(0, 4)` lists the root `0…2` and EU's level `0…2`;
  - opening EU › Open (deepest, count 2) adds two loading rows at once (`rowCount` 6) before any request; its rows page `{ rows: [r1, r2] }` → `entryAt(3)` is r1 with id `'\u0000g["region","EU","status","Open"].0'`; with `getRowId` its id is `getRowId(r1, 0)`;
  - `resolve` with `rows` at a group level returns `'wrong'` and stores nothing;
  - Review Focus 4: a deepest group with `count: 3` answered with 1 row and no `total` shrinks to 1 row;
  - Review Focus 2: `evict` with a range far below an open level keeps at most `KEEP_PAGES` of its pages and the level stays open; an open group whose own root page was evicted still shows its rows at the same shown indexes;
  - closing EU drops its level and its rows (`rowCount` back to 2); reopening asks for its page again (`missingPages` non-empty);
  - `pageSpan` of a row in a failed level page gives its shown start/end; `retry(index)` makes it missing again.
- [ ] **Step 2: Run** `pnpm --filter @argus-table/core exec vitest run src/data/remote-groups.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Levels in a `Map<string, Level>` by key; each open level remembers its parent level's key and its index there (kept when that page is evicted, as `RemoteTree`'s `#seen` does). Shown indexes: per level, its open child levels sorted by index with prefix sums of their sizes (`size(level) = rowCount + Σ size(open child)`), rebuilt once per version; positions resolve by binary search per level, recursively, with a one-entry memo of the last index looked up (as #199 did for `RemoteTree`).
- [ ] **Step 4: Run** the tests — PASS.
- [ ] **Step 5: Commit** `feat(core): RemoteGroups pages every level of a server's groups`.

### Task 3: `RemoteGroups` as the model's rows

**Files:**
- Modify: `packages/core/src/data/remote-groups.ts` (`RemoteRows` and `RowStructure`)
- Modify: `packages/core/src/table/row-pipeline.ts` (`groups()` returns `undefined` silently with `remote`: the remote groups itself)
- Modify: `packages/core/src/index.ts` (export `RemoteGroups`, `GroupLevel`, `RemoteGroupsOptions`)
- Test: `packages/core/src/data/remote-groups.test.ts`, `packages/core/src/table/row-structure.test.ts` (fixture "a data source's groups" in the contract suite, `moves: true`), `packages/core/src/table/grouping.test.ts`

**Interfaces:**
- Produces on `RemoteGroups`: `structure = this`, `tree = true`, `grouped = true`, `entryAt` (data rows only: group rows have no row object), `indexOf` (groups and data rows), `loadedIds()` (data rows only), `stateAt`, `idAt`, `groupAt`, `treeRow` (group rows: `hasChildren` `count > 0`, `open`, `forced: false`, `setSize` the level's total or `-1` while unknown, `posInSet`; data rows: no children), `depthAt`, `parentAt`, `toggleId` (loaded group rows), `mayToggle(id, open)` (`!open` or an id starting with `GROUP_ID_PREFIX`), `shownAncestor`, `standInId` (`'\u0000s' + localIndex + '\u0000' + levelKey`; root rows `'\u0000s' + index + '\u0000'`), `standIn` (`moves: true`; a level that closed gives its group row with `same: false`), `forest()` (loaded rows depth first, every group with one hidden child, as `RemoteTree.forest()` under a filter), `forestRow`.

- [ ] **Step 1: Failing tests:** the contract suite passes for the new fixture (ids without a row view, stand-in round trip as rows load above); a model with `remote: groups` has `tree` true, `rows.grouped` true, `rowAt(0)` and `cellContext(0, …)` `undefined` for a group row and defined (with `depth`) for a data row; `branchSelectAll([])` lists only loaded data ids; a group whose loaded rows are all selected checks `'all'`; Review Focus 5: a stand-in id for the row under an upper-level open group's loading row finds the same row (`standIn`) after that group's page arrives and the rows below move.
- [ ] **Step 2: Run** core tests — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @argus-table/core exec vitest run` — PASS, all existing tests unchanged.
- [ ] **Step 5: Commit** `feat(core): a data source's groups as the model's rows`.

### Task 4: Loading groups from the data source

**Files:**
- Modify: `packages/table/src/controllers/data-controller.ts` (`DataConfig.grouping`; build `RemoteGroups` in `#reset` when `grouping` is non-empty and the source isn't a tree; `rows` returns it, `cache` its `root`; per-level request planning in `request()` / `#load()` through `ranges`, `missingPages`, `inFlightOutside`, `evict`; requests keyed `` `${level.key}\u0001${page}` ``; `#fetchLevel(groups, level, page)` sends `getRows({ start, end, sorting, filters, quickFilter, grouping, groupPath: level.path, signal })`; `'wrong'` fails the page with a `TypeError` whose message says what `getRows` must return there; errors carry `groupPath`; `retry(index)` through `RemoteGroups.retry`; replace `pageAt` / `shownOfTop` with `pageSpan(index): { key: string; start: number; end: number } | undefined` for every mode)
- Modify: `packages/table/src/render/body-state.ts` (Retry labels from `data.pageSpan`)
- Modify: `packages/table/src/argus-table.ts` (pass the effective grouping, the `groupable` ids of `grouping` in order, to `DataController.configure`; `grouping` JSDoc: works with a `dataSource`)
- Modify: `packages/header-menu/src/header-menu.ts` (`canGroup`: allowed with a `dataSource` unless it has `hasChildren` and `getChildren`)
- Test: `packages/table/src/grouping-server.test.ts` (new), `packages/header-menu/src/header-menu.test.ts`

**Interfaces:**
- Consumes: `RemoteGroups` (Tasks 2–3).
- Produces: `DataController.pageSpan(index)`.

- [ ] **Step 1: Failing tests** (`grouping-server.test.ts`, a fake source that groups an in-memory list by the request's `grouping` and `groupPath`, records requests, and can fail or answer wrongly):
  - top-level groups load with `{ grouping: ['region'], groupPath: [] }`; their counts and `totals` render; a source with `pageSize: 2` and 5 groups loads the second page only when scrolled to;
  - opening a group requests `{ groupPath: [{ columnId: 'region', value: 'EU' }] }` and shows its rows; two levels request the middle level's groups first;
  - a plain table (no grouping) still sends `grouping: []` and `groupPath: []`;
  - Review Focus 1: a source answering `{ rows }` at the top level shows a failed page with Retry and fires `argus-load-error` with `groupPath: []`; Retry asks again;
  - Review Focus 3: with EU open, a sort change starts over and EU reopens when its group arrives (`treeExpanded` unchanged);
  - closing a group while its page is in flight aborts nothing that's still in view and shows nothing stale when it lands;
  - with a data-source tree (`hasChildren` + `getChildren`) grouping is ignored with one warning;
  - header-menu: Group by this column is offered with a `dataSource`, not with a data-source tree.
- [ ] **Step 2: Run** `pnpm --filter argus-table exec vitest run src/grouping-server.test.ts src/tree-server.test.ts src/infinite*.test.ts` and `pnpm nx test header-menu` — the new tests FAIL, the others pass.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `BROWSERS=all pnpm --filter argus-table exec vitest run` and `BROWSERS=all pnpm nx test header-menu` — PASS.
- [ ] **Step 5: Commit** `feat(table): group a data source's rows on the server, every level paged`.

### Task 5: Docs, skill, size and the full check

**Files:**
- Create: `apps/docs/src/examples/row-grouping/server/{html,react,vue,angular}/…` and `apps/docs/src/examples/row-grouping/server.ts` (a fake server grouping the sales with a short delay, as `tree-rows/server.ts` does), `apps/docs/e2e/row-grouping.spec.ts` (a test per flavour: open a region, its rows load)
- Modify: `apps/docs/src/content/docs/features/row-grouping.mdx` (a "With a dataSource" section: the request levels, `GroupData`, totals from the server, ids, eviction, errors; drop "not supported yet")
- Modify: `apps/storybook/stories/row-grouping.stories.ts` (a `Server` story with a play function opening a group)
- Modify: `skills/argus-table-integrate/references/server-data.md` (a grouping section), `references/api.md`, `references/gaps.md` (server-side grouping no longer missing), `scripts/lib/libraries.mjs` (drop `SERVER_GROUPING`; AG Grid's server-side row model maps grouping through `groupKeys` → `groupPath`, MUI's data source `groupKeys` the same), `references/migrate/ag-grid.md`, `mui-x.md`, `tanstack.md`, `skills/test/integrate-scan.test.mjs` (the AG Grid fixture no longer has a hard gap)
- Modify: `CLAUDE.md` (Row grouping paragraph: the remote half), `docs/adr/0014-row-grouping.md` (a "Step 2" section), `packages/table/.size-limit.json`
- Create: `.changeset/row-grouping-server.md` (`argus-table` minor; `@argus-table/header-menu` patch)

- [ ] **Step 1:** Write the docs page section, the four-flavour example and its spec; `pnpm nx run-many -t lint typecheck build -p docs` and the docs e2e for `row-grouping` in all engines — PASS.
- [ ] **Step 2:** Skill updates; `pnpm nx test skills` — PASS.
- [ ] **Step 3:** `pnpm size`; set the limit to the measured size + at most 0.3 kB (≤ `61 kB`).
- [ ] **Step 4:** Full check in the Linux copy: prettier on changed files, `pnpm lint`, core, table (`BROWSERS=all`), header-menu, wrappers, generate (clean), skills, Storybook (twice), playground e2e (Chromium), tree, infinite-loading and grouping specs in all engines, docs e2e.
- [ ] **Step 5:** A Node benchmark: a server grouping 1,000,000 rows into 1,000 regions × 10 statuses, three groups open, shown-index lookups per rendered row as in #199; and a flat data source's per-row reads against `main` (unchanged). Numbers go in the PR.
- [ ] **Step 6: Commit** `docs: row grouping with a data source`, then a whole-branch review on the most capable model, fixes, PR.
