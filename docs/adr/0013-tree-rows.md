# ADR 0013: Tree rows inside the row pipeline

- **Status:** Accepted (19 November 2026).
- **Builds on:** [ADR 0010](0010-own-row-model.md) (core's own row model), [ADR 0011](0011-displayed-rows.md) (positions inside, data indexes outside) and [ADR 0004](0004-api-1-0.md) (additions only). Design: `docs/superpowers/specs/2026-11-18-tree-rows-design.md`; plan: `docs/superpowers/plans/2026-11-18-tree-rows.md`.

## Context

Rows with child rows (file trees, org charts, orders with their lines) were one of the gaps that made people keep their old table on a screen when migrating: six of the libraries the integrate skill migrates from have them (TanStack Table, AG Grid, MUI X, Ant Design, Element Plus, PrimeNG/PrimeVue). Row grouping, planned next, needs parents and children too.

What was already fixed:

- **`expanded` is taken**: it's the detail panels' state (ADR 0011), frozen.
- **Every public index means "the nth row in the current order"** (`CellContext.index`, the click events, `argus-range-change`, `scrollToRow(index)`, `getState().scroll.row`, the plugin host). Frozen.
- **A top-level row's default id is its index in `data`.**
- **Positions vs data indexes** (ADR 0011): the element works in positions (rows and panels) and converts at every public edge.

The work comes in two steps: trees held in memory (this record), then children loaded from a `dataSource` when a row is expanded (step 2, designed in the spec, built later).

## Decision

**Child rows are ordinary rows of core's model** (the spec's approach A). Everything that works on rows (sorting, filtering, selection, events, plugins, export, editing, keys, detail panels, measured heights) works on child rows without a special case.

- **One tree per data identity** (`table/row-tree.ts`, `RowTree`): every row by _source index_, with its id, parent, depth and child count in typed arrays, built in O(n) without recursion once per `data`, `getSubRows`, `getParentId` and `getRowId`. Nested data (`getSubRows`) and flat data (`getParentId`) give the same structure. Without either function there is no tree and nothing is allocated.
- **Source indexes.** Top-level and flat rows keep their index in `data`; nested children get `data.length` onwards, depth first. `getRowId(row, index)`, `accessor(row, index)`, `PluginHost.readValue` and `filteredIndexes()` take source indexes, so they mean what they meant for every row that is in `data`.
- **Default ids**: unchanged for top-level rows; a nested child's is its parent's id, a dot and its index among its siblings (`'3.0.2'`).
- **Three pipeline steps replace filtering and sorting when there is a tree** (`table/tree-order.ts`, `RowPipeline`): keep the rows the filters pass with their ancestors (`keepWithAncestors`; descendants of a match are kept only if they match); sort every kept row with one `sortRows` call, then lay them out depth-first by parent (`layoutTree`), so one sort function is picked per column and the radix sort still applies; drop the rows under collapsed ones (`showOpen`). Each step is memoized on what it reads, and expanding or collapsing a row reruns only the last one. `rows()` stays "source indexes in the current order", so `DisplayRows`, positions and every public edge are unchanged.
- **Public indexes count the rows shown.** Children of collapsed rows are out of the current order, like filtered-out rows; expanding a row shifts the indexes below it, as a filter change does.
- **`treeExpanded` is its own state** (ids, controllable, in `TableState`), with `argus-tree-expanded-change` (`{ treeExpanded, rowId, open }`, ADR 0004's naming, so the wrappers bind it two-way). A toggle flips the row's membership in `treeExpanded`, so every toggle can be undone.
- **A filter shows its matches in place.** Rows holding a match show open whatever `treeExpanded` says, without changing it (`TreeRowInfo.forced`); their toggles are disabled (`aria-disabled`, part `tree-toggle-disabled`) and Left moves to the parent instead of collapsing, so nothing changes out of sight. Clearing the filter brings back what people had open. A row whose children are all filtered out shows no toggle.
- **The tree column is the model's first data column** (not the first rendered one, which differs with `virtualizeColumns`). Its body cells render an indent (`--argus-tree-indent` per level) and the toggle (part `tree-toggle`, `tabindex="-1"`, no `preventDefault()`) in the shadow root, before the slotted content. A toggle click toggles only: no click events, no selection.
- **Treegrid ARIA**: the host's role is `treegrid` while there is a tree (a `role` the page set stays); body rows get `aria-level`, `aria-expanded` (rows with children), `aria-setsize` and `aria-posinset` among their kept siblings.
- **Keys** on the tree column (logical, RTL-aware): toward the end expands a collapsed row; toward the start collapses an open row, else moves to the parent; otherwise the arrows move as before. **Enter keeps its meaning** (a cell click; the editing add-on still takes it first). Collapsing a row above the active cell moves the active cell to that row (`shownAncestor`), by key, click or a controlled host.
- **Branch selection** (`selectBranches`, `'multi'` mode only): pure rules in core `state/selection.ts` (`withBranches`, `toggleBranch`, `BranchTree`, `BranchCheck`), used by `SelectionController`. Ticking a row selects it and its descendants the filters keep, never rows a filter hides; a parent's id is selected only when its whole branch is, filters not applied (every descendant in the full tree), so under a filter a parent with unselected hidden children gets its shown rows selected but not its id, and an app acting on `selection` ("delete selected") never reaches rows nobody saw. Its checkbox is part-ticked then, yet counts as checked for a click (which unticks its shown rows) and for the header checkbox, at any depth (checked is worked out from the bottom up, so a grandparent counts through a parent kept out the same way); part-ticked checkboxes for part of a branch; select-all covers every kept row, collapsed ones included, by the same rule. A row that ticking could select nothing for (its id kept out by hidden rows, nothing under it to tick: a parent the filter keeps without its children) is blocked: its checkbox is `disabled`, clicks and Space on it do nothing, and it counts neither for its ancestors' checked state nor for the header checkbox (disabled itself when every kept row is blocked). A controlled value that breaks the rules shows as it is until the user changes it. (Changed in review from "whole kept branch", which let a parent's id in while hidden children weren't selected.)
- **`depth`** is added to `CellContext`, `CellClickDetail`, `RowClickDetail`, `RowDetailContext` and the editing add-on's `argus-cell-edit`, only when there is a tree, so contexts without one are exactly as before.
- **Plugin host**: `rowDepth(index, section?)` and `sourceRow(index)`, required members (plugins never implement the host). Formulas' whole columns read rows through `sourceRow`, so they cover child rows; `applyEdit` takes an optional fourth argument, `{ getSubRows, setSubRows }`, to copy the path to a nested child, and throws without it for a nested edit instead of returning `data` unchanged.
- **Bad trees still show their rows**: a flat row whose parent isn't found or that is part of a cycle becomes top-level, and nested sub-rows that lead back to an ancestor end there, each with one warning per build. Both functions set: `getSubRows` wins, with a warning.
- **With a `dataSource`, trees are ignored in step 1** (rows shown flat, one warning), until step 2.

## Options not taken

- **B. Child rows as a new kind of displayed row**, inserted after their parent like detail panels (what ADR 0011 anticipated). Top-level rows would stay the model's rows and children would have no public index: sorting, filtering, selection, events, export and plugins would each need a "but not for child rows" case. More code and API than A, for worse behaviour.
- **C. An add-on (`@argus-table/tree`) over small core hooks.** Almost no core size, but it needs a public hook for the row order, the surface ADR 0011 turned down, and sorting within parents, ancestor-keeping filters and lazy loading would all go through it. Grouping would have to be an add-on too.
- **Sorting each sibling group on its own.** Simpler to write, but it picks a sort function per group and loses the radix sort on large groups; one global sort and a bucketing pass keep the flat table's speed.
- **Enter toggling the row.** It would change what apps get on Enter in their first column today (`argus-cell-click`).

## Consequences

- Body indexes inside the model are source indexes when there is a tree; code reading `options.data[i]` for a body row reads `pipeline.source()` (`model.sourceRow`) instead.
- **Step 2** (children from a `dataSource`) needs a mapping layer between the shown order and the top-level page cache's indexes (open parents and their shown descendant counts, binary search like `DisplayRows`); `getRows` keeps asking for top-level ranges. Until then the integrate skill lists lazy trees as a soft gap (`lazy-trees` in `gaps.md`).
- **Row grouping** can produce group rows as synthetic parents in the same tree (rows not in `data`, after the nested children's source indexes); the tree column, keys and selection don't assume a parent is a data row.
- Cost: the CDN bundle grows from 46.75 kB to 51.83 kB min+gzip (over the spec's estimate of 2–3 kB; whole-branch selection under filters, its one-pass select-all and blocked rows are 0.39 kB of it) and the editing add-on from 4.16 kB to 4.41 kB, both past their budgets (47 kB and 4.2 kB); with the owner's approval the budgets are now 52 kB and 4.5 kB.
- Evidence: core tests in Node (`row-tree.test.ts`, `tree-order.test.ts`, `create-table.test.ts`, `selection.test.ts`), the table's in all three engines (`tree-rows.test.ts`, `tree-selection.test.ts`), the wrappers' content tests, e2e on a 1M-row tree in the playground (`tree=<n>`, `tests/e2e/specs/tree-rows.spec.ts`), the Tree rows story and the docs site's page with its e2e per flavour.
