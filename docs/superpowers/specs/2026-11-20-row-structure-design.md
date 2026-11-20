# One row structure for flat rows, trees and data-source trees (design)

Status: draft for review, 20 November 2026.

## Why

Tree rows (#195, #196) work, but the knowledge of "how rows are arranged" is spread out. Core's model answers tree questions three ways in each member (`treeRow`, `nextTreeExpanded`, `shownAncestor`, `cellContext`, `indexesPassing`: flat, client tree, data-source tree), and the table package reaches past the model into `RemoteTree` in seven places: `instanceof RemoteTree` in `render/body-state.ts`, `DataController.tree` read by the element, `NavigationController` and `KeyboardRouter`, and the element's `rowDepth`. The element also carries two near-copies of the same expand logic (`expanded` for detail rows, `treeExpanded` for tree rows).

The next feature is **row grouping** (group rows by column values, with aggregates). ADR 0013 already decided its shape: group rows are synthetic parents in the tree, rows not in `data`, with their own indexes after the nested children's source indexes. Today that would mean a fourth branch in each of those model members and in each table module that branches.

Grouping is planned for **local `data` and for a `dataSource`** (the maintainer, 20 November). With a data source the server groups: group rows are parents it sends, and each group's rows load under it like a data-source tree's children. So remote grouping is a data-source tree whose parents aren't data rows and whose children come from another request than `getChildren`. Grouping combined with tree rows (`getSubRows`, `getParentId`, `hasChildren`) is not planned (my reading; AG Grid keeps the two apart too).

The goal is that the code is **easier and safer to change**, measured against grouping: after this refactor, local grouping should be a new row structure in core plus rendering for group rows and aggregates, and remote grouping should reuse `RemoteTree`'s machinery with a different way of fetching a parent's children. Keyboard, navigation, selection and body state stay unchanged in both; the data controller changes only where children are requested.

## Goals

- One internal interface in core, `RowStructure` (name is the builder's call), that answers every question the model and the table ask about how shown rows are arranged. Flat rows (local `data`), client trees, flat data-source rows and data-source trees each implement it; the model picks one and delegates to it.
- The table package asks the model (or the structure) only. No `RemoteTree` value import, no `instanceof RemoteTree`, no `DataController.tree` getter outside `DataController`.
- Every shown row has an id from the structure (`idAt`), loaded or not, so row identity no longer goes through `rowAt(index)?.id` and "no `RowView`" no longer means "no id".
- `RemoteTree` and `DataController`'s child loading don't assume a parent is a row of `data` or that its children come from `getChildren`: the request for a parent's children is one seam grouping can swap.
- The element's two expand states share one toggle path.
- Every move preserves behaviour exactly. Existing tests pass unchanged after every PR (a test may change only its import path or reach a renamed internal).

## Non-goals

- No public API change: properties, methods, events and their details, parts, tokens, slots, ARIA output, `PluginHost` members, the DOM the table renders. The wrappers' generated files must come out identical.
- No grouping, no aggregates, no new options.
- Detail panels: `DisplayRows` (`table/display-rows.ts`) and the position ↔ data index conversions stay as they are. Only the toggle path is shared with tree rows (Part 1).
- Loading logic stays in `DataController` and `RemoteTree`: requests, `wanted`, `beginChildren` / `resolveChildren` / `failChildren`, `forget`, retries, kept counts, and the paging maps (`topRange`, `topIndexOf`, `positionOfTop`) that turn shown indexes into pages.
- No perf fixes folded in. Two found during the survey go in separate PRs afterwards (see Follow-ups).
- No shared "table context" object, no rework of controllers beyond what a moved caller needs (as in the 18 November split).

## Anti-goals

- **A slower table.** The structure sits on hot paths: `stateAt` and `treeRow` per rendered row, `depth` per cell (see Constraints). An interface call that allocates, or turns a monomorphic call site polymorphic in a loop that runs per cell, is a regression even if the code reads better.
- **An abstraction grouping can't use.** If the interface assumes a parent is a row of `data` (has a `RowView`, a source object, a value), grouping will have to special-case it, which is what we're removing.
- **A bigger bundle.** The CDN bundle is 55.69 of 56 kB. See Constraints.
- An interface that grows a member per caller: if a member is used by one caller and isn't about arrangement, it doesn't belong.

## Constraints

- **Hot paths** (per rendered row, every render, including every scroll frame when scaled):
  - `body.ts:226` `loading.stateAt(index)`; with a data-source tree that is `RemoteTree.stateAt` (one or two binary searches).
  - `body.ts` via `TreeRows.row` → `model.treeRow(index)`: allocates a `TreeRowInfo` today.
  - `virtual-controller.ts:397` `rowIdAt` → `NavigationController.rowId` → `model.rowAt`, and for unloaded rows `#placeholderId`.
  - `body.ts:346` checkbox state → `forestRow`.
  - Per cell: `render/cells.ts` → `model.cellContext` / `valueAt`; with a data-source tree `cellContext` calls `depthAt` per cell.

  None of these may get more expensive. Allocation per call must not grow; where the model today goes straight to a pipeline array, it must not gain an extra indirection inside a per-cell loop (resolve the structure once per call, not per member access).

- **Size.** The whole series must stay inside the current 56 kB CDN budget (headroom 0.31 kB); no raise. Each PR states `pnpm size` before and after. Ideally it shrinks: today's three-way branches and the element's duplicate toggle are code that goes away.
- **Minification** (from the 18 November split): the CDN build renames `#private` members and module-level functions but not public member names or object-literal keys. The interface's members are public names, so keep the interface small and its implementations classes with `#private` state.
- **Core stays DOM-free** and its tests run in Node.
- **Identity contracts.** `model.rowOrder` keeps its identity in exactly the cases it does today (the virtualizer's `MeasuredSizes`, `RowMeasure`, selection's select-all cache and formulas' universes rely on it). For a data-source tree that is `remote.order`.
- Repo conventions (strict TS, `.js` extensions, `import type`, comments that say why).

## Approaches considered

1. **One row-structure interface in core (chosen).** The model always has a structure; flat rows, client trees, flat data-source rows and data-source trees implement it; the table asks the model. Grouping becomes another implementation. Risk is concentrated on the hot paths, which the constraints pin down.
2. **Table side only.** A controller owns `expanded` / `treeExpanded`, the toggles, the role and the depth plumbing; core untouched. Cheaper and safer, but core keeps its three-way branches and the table its reads of `RemoteTree`; grouping adds a fourth branch in both. It survives as Part 1.
3. **One display list for everything.** Merge `DisplayRows` and the tree into one list of typed rows (data, detail, group, placeholder). The most uniform end state, but it rewrites every position ↔ index conversion at the element's edges, the riskiest code for an "easier to change" goal.

The maintainer picked 1, with 2's element cleanup as the first PR.

## Part 1: the element's expand states

`expanded` (detail rows) and `treeExpanded` (tree rows) are the same kind of state: a controllable `readonly string[]` of row ids, an `argus-<property>-change` event with the same detail shape, a toggle that reads the row id, computes `open = !includes(id)`, asks the model for the next value (`nextExpanded` / `nextTreeExpanded`) and calls `#events.change`. Today:

|                         | `expanded`                             | `treeExpanded`                                   |
| ----------------------- | -------------------------------------- | ------------------------------------------------ |
| Toggle                  | `#toggle` (`argus-table.ts` 1651–1660) | `#toggleTree` (1668–1681), plus a `forced` guard |
| Click handler           | `#onToggle` (1695–1697)                | `#onTreeToggle` (1704–1711), plus `nav.moveTo`   |
| `getState` / `setState` | 1159 / 1195                            | 1160 / 1197                                      |

Change: one private toggle taking the state, the event and the next-value rule, used by both; the two click handlers stay (they differ in what they do after). The `forced` guard moves into the model's tree toggle rule (Part 2's `toggleId`), so the element doesn't read `treeRow` to toggle. The two properties, their JSDoc and their events stay as they are.

Small enough to be one PR; table package only (core gains nothing until Part 2, so the `forced` check stays in the element in this PR and moves later).

## Part 2: `RowStructure` in core

### What it answers

All indexes are **shown indexes** (the body's data indexes: what `model.rowAt` takes; positions of detail panels are a layer above and stay so). Proposed members, from what the model and the table ask today (survey of 20 November):

| Member              | Answers                                                                                                                                                                                                                                                        | Today                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tree`              | Whether the rows form a tree (the table's `treegrid` role, the tree column, keys)                                                                                                                                                                              | `model.tree` = `pipeline.tree() \|\| remoteTree()`                                                         |
| `stateAt(index)`    | `'loaded' \| 'loading' \| 'error'`                                                                                                                                                                                                                             | `DataController.stateAt` → `PageCache` / `RemoteTree`; local rows are always loaded                        |
| `parentAt(index)`   | Shown index of the parent of any row, loaded or a placeholder; `undefined` at the top level. Tells a failed page (top level) from failed children (has a parent), and replaces `parentIdAt` + `shownIndexOf` in `keyboard.ts:198–207`                          | `TreeRowInfo.parent` for loaded rows; `RemoteTree.parentIdAt` for placeholders                             |
| `treeRow(index)`    | `TreeRowInfo` of a loaded row                                                                                                                                                                                                                                  | `model.treeRow`, three-way                                                                                 |
| `depthAt(index)`    | Depth of any row, loaded or not                                                                                                                                                                                                                                | `RemoteTree.depthAt`; `treeRow().depth` otherwise; the element's `rowDepth` picks                          |
| `toggleId(index)`   | The id a click on this row's toggle changes, or `undefined` (not loaded, no children, `forced`): the element's guard, nothing more                                                                                                                             | `#toggleTree`'s checks                                                                                     |
| `canExpand(id)`     | Whether an id may be added to `treeExpanded` (the id rule behind `nextTreeExpanded`, which takes ids not shown, closes unloaded ids and ignores `forced`: a controlled host's ids are never refused)                                                           | `nextTreeExpanded`'s `canExpand` / `childCount`                                                            |
| `shownAncestor(id)` | The row's shown index, else its nearest shown ancestor's                                                                                                                                                                                                       | `model.shownAncestor`, three-way                                                                           |
| `idAt(index)`       | The id of any shown row: the row's id when loaded, else a stand-in that survives rows loading above it (a data-source tree's top-level index or parent id and offset, `\u0000…` when ids are reserved, else the index). Group rows answer with their group id. | `model.rowAt(i)?.id`, then `NavigationController.#placeholderId` and `#reserved` (`navigation.ts:484–524`) |
| `locate(id)`        | The reverse: `{ index, same }` for any id `idAt` gives, `same: false` when the row is gone and the index is a replacement (its parent or nearest shown ancestor); `undefined` for an unknown id                                                                | `model.indexOf`, `NavigationController.#placeholderRow` (`navigation.ts:533–559`)                          |
| `forest()`          | The `TreeForest` (+ `at(index)`) branch selection runs on                                                                                                                                                                                                      | `forestOf` / `forestRow` in `create-table.ts`, two-way                                                     |
| `order`             | The object whose identity is `rowOrder`                                                                                                                                                                                                                        | `remote.order ?? remote`, or `pipeline.rows()`                                                             |

Members that only one structure can answer return `undefined` / `false` from the others (flat: `tree` false, `treeRow` undefined, `depthAt` 0, `parentAt` undefined). The stand-in rule for unloaded rows moves into core with `idAt`, including when ids are reserved (`getRowId` set, or a data-source tree); `NavigationController.rowId` keeps only its own rule on top: an unloaded row under the active cell keeps the active cell's row id, so its DOM and focus stay put.

`idAt` is on the per-row key path (`virtual-controller.ts:397` → `rowIdAt`), so for loaded rows it must cost no more than `rowAt(i)?.id` does today (ideally less: it needn't build a `RowView`). Readers of a row's object (`RowView.original`: click events, the detail context, `#measureAutoWidths`) stay on `rowAt`; what a group row's `rowAt` returns is the grouping design's call. Whether `rowAt`, `rowCount`, `indexOf`, `valueAt` and `cellContext` move onto the structure too, or stay on the model reading the pipeline / remote directly, is the builder's call, decided by the hot-path constraint: if routing `cellContext` through the structure adds a call per cell, leave it.

What the interface must not assume, for grouping: that a row with children is a row of `data` (a group row has an id, a depth, children and `TreeRowInfo`, but no source object and no `RowView.original` from `data`), or that ids come from `getRowId`.

### Implementations

- **Local flat** and **local tree**: from `RowPipeline` (`table/row-pipeline.ts`), which already holds the memoized steps. Likely one class over the pipeline with the tree members reading `treeSteps()`, or two; builder's call.
- **Flat data source**: over `PageCache` (state, count; no tree).
- **Data-source tree**: `RemoteTree` (`data/remote-tree.ts`) implements it directly; it already has nearly every member. `parentAt`, `idAt` and `locate` move in from `NavigationController` and `keyboard.ts`. The paging maps and loading bookkeeping stay public on `RemoteTree` for `DataController`.

For remote grouping later, `RemoteTree` must not depend on what a parent is beyond its id and whether it has children: `#hasChildren(entry.row)` (the app's `hasChildren`) is the one place it reads a parent's row, so it becomes a function `RemoteTree` is given (today's `DataSource.hasChildren`; grouping's "is a group row"). In `DataController`, `#fetchChildren` (`data-controller.ts` 340–382) calls `getChildren(parent, { signal })` in one place; that call becomes a function chosen when the tree is built, so grouping passes its own (a `getRows` request with the group's keys). Neither changes behaviour now.

`RemoteRows`' optional tree members (`model-types.ts` 149–193) are replaced by the structure: a remote is either a flat paged source or a tree, not a flat source with optional extras. Builder's call how `remote` reaches the model (one option: the model takes `remote` as today and wraps a `PageCache` itself; `RemoteTree` is already a structure).

### The model

`createTableModel` picks the structure once per `update()` and its members delegate: `treeRow`, `nextTreeExpanded` (same id-based rule and signature as today, reading `canExpand`; its tests in `create-table.test.ts` stay unchanged; my call), `shownAncestor`, `branchTree` / `branchCheck` / `branchCheckAll` / `branchSelectAll` (through `forest()`), `cellContext`'s depth, and `sourceRow` (which returns `undefined` for remote rows itself, so the element's guard at `argus-table.ts:840` goes). Whether `TableModel` keeps these members as delegates or exposes `model.rows` (the structure) for the table to call is the builder's call; `TableModel` is internal (core is private), so either is allowed, but core's `index.ts` exports used by `argus-table` must keep working.

`state/selection.ts` needs no change: `BranchTree` and `TreeForest` are already shared by both tree kinds.

## Part 3: the table package asks the model

Once the structure exists, these callers change (survey of 20 November; line numbers as of `7cbe470`):

| Where                                                                                                                                 | Change                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render/body-state.ts` `loadingState`                                                                                                 | Takes the structure (or the model) instead of `PageCache \| RemoteTree`; children-error rows are `stateAt === 'error'` with a `parentAt`. The "rows x–y" Retry label still needs the page and `positionOfTop`: that part asks `DataController` (paging, not structure). |
| `render/body-state.ts` `treeRows`, `render/body.ts` `TreeRows`                                                                        | The `remote` parameter and the optional `depth` go: depth comes from `depthAt`.                                                                                                                                                                                         |
| `argus-table.ts` `rowDepth` (832–838), `sourceRow` (840), `#toggleTree`, the RowMeasure `stateAt` (914), `#syncDetails`' depth (1579) | Read the model.                                                                                                                                                                                                                                                         |
| `controllers/keyboard.ts` 170, 198–207                                                                                                | `stateAt`, `parentAt`.                                                                                                                                                                                                                                                  |
| `controllers/navigation.ts` `rowId`, `#remote`, `#placeholderId`, `#placeholderRow`, `#reserved`, `reconcile` 684                     | `rowId` is `idAt` plus the active-cell rule; `reconcile` finds held rows with `locate`; `#placeholderId`, `#placeholderRow`, `#reserved`, the `#remote` getter and the `() => this.#data.tree` argument go.                                                             |
| `controllers/virtual-config.ts` `rowIdAt`                                                                                             | Through `NavigationController.rowId` as today (now `idAt`).                                                                                                                                                                                                             |
| `controllers/data-controller.ts` `get tree`, `stateAt`                                                                                | `tree` goes; `stateAt` goes if nothing else reads it. `treeExpanded` still reaches `RemoteTree.setExpanded` through `configure`.                                                                                                                                        |

Checkable end state: `grep -rn "RemoteTree" packages/table/src --include=*.ts | grep -v test` shows only `data-controller.ts` (and type-only imports where a type is unavoidable, none in render/ or the other controllers).

## The grouping walk-through (the measure)

After the series, grouping should touch:

- core: a grouping step (rows → group rows by column values, laid out as synthetic parents), a structure over it, aggregates, the new options in `types.ts`;
- the element: the new properties and their controllable state (through Part 1's toggle path, if group expansion reuses `treeExpanded` or gets its own);
- rendering: group rows' cells (key and aggregates) in `render/body.ts` / `render/cells.ts`, labels.

For remote grouping, additionally: `RemoteTree` built with a group-aware `hasChildren` and `DataController` with a group-children request, and the `getRows` request shape (the grouping design's call).

And not: `keyboard.ts`, `navigation.ts`, `selection.ts`, `body-state.ts`, `scroll-target.ts`, nor `data-controller.ts` beyond choosing the children request. Selection ranges and click events need the grouping design to decide what a group row is to them (selectable or not, `original` or not); that's a product decision, not a branch this series can remove. The final PR description walks through this list against the code and names anything that would still need a branch.

## Testing

- Existing unit, Storybook and e2e tests pass unchanged after every PR; `tree-rows.test.ts`, `tree-selection.test.ts`, `tree-server.test.ts`, `detail-rows.test.ts` and `create-table.test.ts` are the main net.
- New: one contract test suite in core run against every structure implementation (flat, local tree, flat data source, data-source tree) for the shared members (`stateAt`, `parentAt`, `depthAt`, `toggleId`, `canExpand`, `shownAncestor`, and `idAt` / `locate` round-tripping as rows load above, with and without `getRowId`). The stand-in id cases in `navigation` and `tree-server.test.ts` carry over as they are.
- Identity: a test for each `rowOrder` identity case `create-table.test.ts` doesn't already cover.
- Perf: Chromium unit-level timing of a scaled scroll through a data-source tree before and after (an ad-hoc measurement is enough; the published benchmarks don't cover trees), plus `pnpm size`.

## Delivery

A series of PRs into `main`, each green and behaviour-preserving, like #185–#189:

1. Part 1: the element's shared toggle path (table only).
2. Core: the interface and its implementations, the model delegating to it, `RemoteRows`' optional members replaced, contract tests. Table unchanged apart from imports.
3. Table: body state, body, element depth and `sourceRow` through the model.
4. Table: keyboard and navigation through the structure (`idAt`, `locate`, `parentAt`); `DataController.tree` removed. Includes the timing check of the per-row key path.
5. The two seams for remote grouping: `RemoteTree`'s `hasChildren` and `DataController`'s children request as functions chosen when the tree is built.

The builder may split or merge these; each PR states `pnpm size` before and after.

## Follow-ups (separate PRs, not part of this series)

- `RemoteTree.treeRow` calls the app's `hasChildren(row)` on every call for top-level rows, i.e. per rendered row per render; cache it per loaded entry.
- With a data-source tree, `cellContext` calls `depthAt` (a binary search) per cell; once per row would do.

## Left to the builder

Names; whether the local flat and tree structures are one class or two (they needn't compose: grouping isn't combined with tree rows); whether `TableModel` keeps delegate members or exposes the structure; whether `rowAt` / `rowCount` / `cellContext` move onto the structure (hot-path constraint decides); how `remote` reaches the model; PR boundaries within the order above.
