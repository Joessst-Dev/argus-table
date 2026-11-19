# Tree rows

- **Date:** 18 November 2026
- **Status:** Design, for review (builder check done)

## Intent

Rows can have **child rows**: a tree of rows people expand and collapse, each level indented under its parent, like a file tree, an org chart, product categories or orders with their line items as rows of the same table.

Tree data is one of the three gaps that make people keep their old table when they migrate (`skills/argus-table-integrate/references/gaps.md`: "If a screen depends on one of the hard gaps (row grouping, tree data, range selection), recommend keeping the old table on that screen"). Six of the libraries the `argus-table-integrate` skill migrates from have it: TanStack Table (`getSubRows`), AG Grid (`treeData`, `getDataPath`), MUI X (`treeData`, `getTreeDataPath`), Ant Design (`children` in rows), Element Plus (`tree-props`, `lazy` + `load`) and PrimeNG/PrimeVue (`<p-treeTable>`). Success is that those screens can move to argus-table.

Row grouping (group rows by a column's values, with totals) is planned next, on top of this. This design doesn't build grouping, but it must not block it (see [Row grouping later](#row-grouping-later)).

The work comes in **two steps**, shipped in this order:

1. **Client-side trees:** the app has every row in memory, nested or flat.
2. **Children loaded from the server:** with a `dataSource`, a row's children load when it's expanded, one request per expand.

Step 2 is designed here so that step 1 can't paint it into a corner, but it's built and released after step 1.

Everything public here is API, frozen once released under [ADR 0004](../../adr/0004-api-1-0.md)'s compatibility policy (additions only).

## Goals

- Child rows are **real rows**: they have cells in every column, can be sorted, filtered, selected, edited (`@argus-table/editing`), clicked (events), focused, scrolled to, read by plugins and exported, exactly like top-level rows today.
- Rows with children show a toggle (a chevron button) in the tree column, indented by level. Clicking it, or a key, expands or collapses the row.
- Which rows are expanded is state: controlled or uncontrolled, saved by `getState()`, with a change event.
- Sorting sorts **siblings among themselves**: children stay under their parent.
- Filtering keeps a match's **ancestors**, so a match is always shown in its place in the tree.
- Selection: ticking a row selects that row only, by default. **Branch selection** is an option: ticking a parent selects its whole branch, and parents with a partly selected branch show a part-ticked checkbox.
- Keyboard and screen readers: the WAI-ARIA treegrid pattern, adapted to the table's cell focus (see [Keyboard and accessibility](#keyboard-and-accessibility)). axe passes.
- Works with detail panels (any row, at any level, can also open a panel), pinned columns, column virtualization, column groups, `rowHeight: 'auto'`, RTL, `getState()`/`setState()`, the column menu, formulas, editing and export, and the React, Vue and Angular wrappers.
- Stays fast at 1M rows: the benchmark gate passes on a 1M-row tree, and expanding or collapsing a row is quick (see [Performance](#performance)).
- Step 2: with a `dataSource`, expanding a row loads its children with one request, with the current sort and filters; children can have children of their own, loaded the same way.

## Non-goals

- Row grouping and aggregation (next feature, separate design).
- Children loaded **page by page** as they scroll into view (a parent with tens of thousands of children on the server). Step 2 loads all of a parent's children with one request. The request is shaped so a range can be added later without breaking anything.
- Dragging rows to reparent or reorder them.
- Tree structure in `pinnedRows`.
- Connector lines between levels.
- Exporting the tree's outline (Excel outline levels, PDF indentation): the export add-on exports the rows shown, flat, as today. A follow-up can add levels.
- An "expand all" button in the table. Apps set `treeExpanded` themselves; a method can be added later.
- A choice of which column holds the toggle (see [The tree column](#the-tree-column)): the first data column holds it. An explicit choice can be added later.

## Anti-goals

- Tables without a tree must not get slower or allocate more: with no tree configured every new step is the identity, as `DisplayRows` is without panels.
- Child rows must not be second-class: no feature should need a special case "but not for child rows".
- No breaking change to anything frozen: `expanded` keeps meaning detail panels, every public index keeps meaning "the nth row in the current order", events keep their details.

## Constraints

- **`expanded` is taken.** It's the detail panels' state (ADR 0011), frozen. Tree expansion needs its own property and event.
- **Public indexes.** Every public index (`CellContext.index`, `argus-cell-click`/`argus-row-click`'s `index`, `argus-range-change`, `scrollToRow(index)`, `getState().scroll.row`, the plugin host, `RowDetailContext.index`) means "the nth row in the current (filtered and sorted) order". With trees, the current order is the rows **shown**: children of collapsed rows aren't in it, as filtered-out rows aren't. Expanding a row shifts the indexes of the rows below it, as a filter change does.
- **Default row ids.** Without `getRowId`, a row's id is its index in `data` as a string. That must stay true for top-level rows.
- **Bundle size.** The CDN bundle is at 46.75 of 47 kB. Step 1 will need the budget raised by an estimated 2–3 kB, step 2 by about 1–1.5 kB more; each raise needs the owner's approval in its PR (as before).
- **Positions vs data indexes** (ADR 0011): inside the element the body counts positions (rows and detail panels); everything public converts at its edge. Tree rows don't change that split: child rows are data rows, so they count as data indexes.

## Approaches

Three ways were considered; **A was chosen**.

**A. Tree rows inside the row pipeline (chosen).** Child rows are ordinary rows of core's model. Core flattens the tree once per `data` into one array of rows with each row's parent and depth; the pipeline filters (keeping ancestors), sorts within siblings and drops rows under collapsed parents. Collapsing works like a filter. Everything that works on rows (selection, events, plugins, export, editing, keyboard) works on child rows unchanged. `DisplayRows` stays as it is. _Trade-off:_ a few kB in core, and step 2 needs a layer that splices children into the remote row order.

**B. Child rows as a new kind of displayed row** (what ADR 0011 anticipated). Top-level rows stay the model's rows and children are inserted after their parent like panels. _Rejected:_ children would be second-class: no public index, and sorting, filtering, selection, events, export and plugins would each need special cases. More code and API than A, for worse behaviour.

**C. An add-on (`@argus-table/tree`) over small core hooks.** The add-on flattens and filters the tree and wraps the first column's cells; core adds tree attributes on rows and a hook for the row order. _Rejected:_ almost no core size, but a public row hook, which ADR 0011 turned down as another surface to freeze, and sorting within parents, ancestor-keeping filters and lazy loading would all have to go through it. Grouping would have to be an add-on too.

## Design

### Public API (step 1)

All additions. Names are proposals to confirm in the plan's API review; the shapes are decided.

On `<argus-table>` (and `TableModelOptions` in core):

| Property         | Type                                      | Meaning                                                                                                                           |
| ---------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `getSubRows`     | `(row: T) => readonly T[] \| undefined`   | Nested data: a row's children. `data` holds the top-level rows.                                                                   |
| `getParentId`    | `(row: T) => string \| null \| undefined` | Flat data: the id of a row's parent (a `getRowId` id), or nothing for a top-level row. `data` holds every row.                    |
| `treeExpanded`   | `readonly string[]` (`TreeExpandedState`) | The ids of expanded rows. Controllable (`controllable()`), in `TableState` and `getState()`/`setState()`. Default: none expanded. |
| `selectBranches` | `boolean` (attribute `select-branches`)   | Branch selection (see [Selection](#selection)). Default `false`.                                                                  |

Setting both `getSubRows` and `getParentId` is a mistake: `getSubRows` wins, with a console warning once. Neither set: no tree, and nothing below applies.

Event: **`argus-tree-expanded-change`**, `detail: { treeExpanded, rowId, open }`, fired like `argus-expanded-change` (after the update, or right away with the proposed value when controlled). The name follows ADR 0004's rule (`argus-<property>-change`, value under the property's name), so the wrappers derive two-way binding (`treeExpandedChange` in Angular, `v-model:tree-expanded` in Vue).

Context: `CellContext` and `CellClickDetail` gain an optional **`depth`** (0 for top-level rows), so `cell` functions and click handlers can tell levels apart. `RowDetailContext` gains it too.

Labels (`TableLabels`): the toggle's accessible names, `expandRow` / `collapseRow` style (exact keys in the plan), English defaults and German in the Labels story, per ADR 0005.

Parts and tokens: `tree-toggle` (the button), `tree-indent` or an indent applied to the cell's content box (builder's choice, one documented way to restyle it), and a token for the indent per level, `--argus-tree-indent` (default about 1.25rem). Rows get a part for their level only if a theme needs it (`row-level-1`… is not planned).

### Where tree rows come from

- **Nested (`getSubRows`).** Core walks `data` depth-first and builds one flat array of row objects: each top-level row followed by its descendants. A row's default id is its index in `data` for top-level rows (unchanged) and its parent's id, a dot, and its index among its siblings for children (`'3.0'`, `'3.0.2'`), as TanStack does. With `getRowId`, its ids are used throughout.
- **Flat (`getParentId`).** `data` already holds every row. Core finds each row's parent by id (`getRowId` is needed for this to mean anything; without it, ids are indexes as strings, which still works if the parent ids are). A row whose parent id isn't found, or that is part of a cycle, is a top-level row, with a console warning once (my call: showing the row beats dropping it).

Either way the result is the same internal structure, built once per `data` / `getSubRows` / `getParentId` / `getRowId` identity, in O(n): every row, each row's parent (an index or -1), its depth, and its children. With no tree configured, nothing is allocated.

**Row indexes (the "source index").** Several public surfaces pass a row's index in `data`: `getRowId(row, index)`, `accessor(row, index)`, `PluginHost.readValue(row, column, index)` and `PluginHost.filteredIndexes()`. They keep that meaning for every row that is in `data`:

- Without a tree, and with flat data (`getParentId`): a row's index in `data`, as today. Every row is in `data`.
- With nested data (`getSubRows`): top-level rows keep their index in `data`, and nested children get indexes from `data.length` on, in depth-first order. So the pipeline's index space is `data`'s indexes followed by the children's.

The docs of those members say so. Everything that today reads `options.data[i]` for a body row reads the row at a source index instead (the same object for `i < data.length`). Pinned rows are untouched.

### The pipeline

Today: all rows → filtered → sorted (`RowPipeline`). With a tree:

1. **Filter, keeping ancestors.** A row passes if it matches, or if any of its descendants matches (my call, matching AG Grid and MUI X: a match is always shown in its place). Children of a matching row are **not** kept unless they match themselves (my call, MUI X's default; a later option can include them). One pass from the leaves up, O(n).
2. **Sort within siblings.** Each sibling group is sorted by the current `sorting`, with the existing `sortRows` (radix for numbers, comparator otherwise; `undefined` last; ties in data order), and the tree is laid out depth-first from the sorted groups.
3. **Drop rows under collapsed rows.** A row is shown if every ancestor is expanded (`treeExpanded`). **While a filter or quick filter is on, ancestors of matches are shown expanded** whatever `treeExpanded` says, without changing it (my call: people filter to find rows, and a match hidden under a collapsed parent defeats that). Toggling a row during a filter changes `treeExpanded` as usual; it takes visible effect on rows that don't hold matches, and fully once the filter clears. (The builder may find a simpler rule that keeps "a match is never hidden"; that property is the requirement.)

The result is the row order (`rowOrder`), memoized like today on its inputs, plus each shown row's depth and whether it has children (for the toggle and `aria-expanded`). Steps 1–2 depend only on data, filters and sorting; step 3 alone runs when a row is expanded or collapsed, so expanding doesn't re-sort.

Detail panels (`DisplayRows`) apply after this, unchanged: any shown row can have a panel.

### The tree column

The **first shown data column** in the column order holds the toggle and the indent (my call; every library above defaults to the first column, and a choice can be added later). If the column order changes, the tree column follows: it's always the first data column, after the selection checkbox and detail chevron columns. In that column's cells (body rows only), the shadow root renders the indent and, on rows with children, the toggle button before the slot with the light-DOM content, so the app's content is unchanged. The toggle is in the cell's shadow DOM, like the selection checkboxes (its click handler must not `preventDefault()`, per the selection checkbox's note in CLAUDE.md).

With `virtualizeColumns`, the tree column is kept rendered while it holds the active cell, like any column; nothing new.

### Keyboard and accessibility

- The host's role becomes `treegrid` (ElementInternals and the `role` attribute, as for `grid` today) when a tree is configured.
- Body rows get `aria-level` (depth + 1), `aria-expanded` (`true`/`false`) on rows with children, and `aria-setsize` / `aria-posinset` (among their shown siblings), since the rows are virtualized.
- Keys on a cell of the tree column (logical directions, RTL-aware like the other keys):
  - **Right** on a collapsed row with children expands it (focus stays); otherwise moves right as today.
  - **Left** on an expanded row collapses it; on a collapsed row or a row without children, moves focus to its parent row's tree cell; on a top-level row, moves left as today (to the checkbox or chevron column if there is one, else nothing).
  - **Enter** on a tree cell keeps its meaning today (it goes to the cell's content when it has interactive content; else it toggles the row: builder to check against `KeyboardRouter`'s Enter handling and the editing add-on, which uses Enter to start editing, and pick the order that doesn't break editing).
  - Space keeps selecting.
- Collapsing a row that holds the active cell's row (a descendant was focused) moves the active cell to the collapsed row, in the same column.
- The toggle's accessible name comes from the labels; it isn't a tab stop (the grid has one roving tab stop).
- Expanding or collapsing announces nothing extra (`aria-expanded` changes); a filter that keeps ancestors announces the shown row count as today.

### Selection

- Default (`selectBranches` off): unchanged. Ids are rows; ticking a parent selects the parent only. Shift ranges go by index in the shown order, across levels. Select-all selects the selectable shown rows (rows under collapsed parents aren't selected; my call, consistent with select-all with a `dataSource`).
- `selectBranches` on (my calls throughout, after Ant Design's checkbox trees, as one consistent rule; the pure rules go in core `state/selection.ts`):
  - Ticking a row selects it **and its descendants the filters keep** (step 1: all of those; step 2: those loaded). Descendants a filter hides are not selected, so "delete selected" never reaches rows the user can't see. Unticking deselects the same set.
  - **A parent's own id is in `selection` exactly when its whole branch is selected** (every descendant the filters keep): ticking the last unselected child adds the parent's id (and so on up), unticking any child removes the ids of its ancestors. The table writes these normalized sets in the events it fires.
  - The checkbox shows **ticked** when the row's id is selected and no descendant the filters keep is unselected, **part-ticked** (`aria-checked="mixed"`, the `indeterminate` property) when the row or some descendant is selected but not all, else unticked. It shows what `selection` holds: a controlled value that contradicts the rule (a parent id without all its children) is shown as it is (part-ticked) and not rewritten until the user changes it.
  - **Select-all** selects every row the filters keep, whole branches included (also rows under collapsed parents), and the header checkbox is ticked when all are selected.
  - Children loaded later under a selected row (step 2) are added to the selection when they arrive, through the normal change event (the user ticked the whole branch).
  - Ctrl/Cmd and Shift clicks work as today, each row clicked counting as its branch.
  - `selection` stays a list of ids, unchanged in type.

> **Changed in review (19 November 2026): whole branch only.** The rule above counted a branch as whole when every descendant the filters _keep_ was selected. Under a filter, ticking a parent then added the parent's id although its hidden children weren't selected; after the filter cleared, the parent showed part-ticked while its id was in `selection`, so an app's "delete selected" deleted children the user never saw. The owner's decision replaces the second and third bullets and the select-all one:
>
> - A parent's id is in the selection the table proposes only when its **whole** branch is selected, filters not applied (every descendant in the full tree). A tick selects the row and its kept descendants (never hidden rows), then the ids of the row and its ancestors where that holds.
> - A row counts as checked (so a click or Space unticks it: its id, its kept descendants, its ancestors' ids) when every kept descendant is selected and its own id is too, or, for a row with kept children, its id is kept out by unselected hidden rows. (A selected id with a kept descendant unselected, which only a controlled value can give, ticks the rest, as before.) Under a filter, such a parent shows part-ticked, unticks on the next click and ticks again on the one after.
> - The checkbox is ticked when the row's id and every kept descendant are selected, part-ticked when some are (as before; a parent kept out by hidden rows shows part-ticked).
> - Select-all selects every kept row by the same rule; the header checkbox is ticked when every kept row counts as checked.
>
> Without a filter nothing changes. Edge: a parent the filter keeps without any of its children (it matches, they don't) can't be ticked while the filter is on, since its id needs the hidden children.

### Everything else that touches rows

- `getState()`/`setState()`: `treeExpanded` saved and restored like `expanded`. `scroll.row` is an index in the shown order, so it's restored after `treeExpanded`.
- `scrollToRow({ id })` for a row under a collapsed parent does nothing, as for an unknown id (my call: the app expands its ancestors first; a method that reveals a row can be added later).
- Plugins: `PluginHost` read members see shown rows, like today. Two required read members are added (plugins never implement the host, so adding them isn't breaking, ADR 0004): a row's depth (e.g. `rowDepth(section, index)`), and **the row object at a source index** (e.g. `sourceRow(index)`), since `filteredIndexes()` can return indexes of nested children that aren't in `data`.
- `filteredIndexes()` returns the source indexes of the rows the filters keep, **including ancestors kept only because a descendant matches**, and rows under collapsed parents (they're data, not view) (my call: they're the rows a filtered tree shows once expanded).
- **Formulas** (step 1 scope): whole columns read rows through the new host member instead of `host.element.data[index]` (`rowSource` in `packages/formulas/src/columns.ts`), so nested children are in ranges. Check its size budget (about 40 B of headroom).
- **Editing** (step 1 scope): `applyEdit(data, detail, columns)` finds the row in `data` by identity, which works for flat trees but not for nested children. It gets an optional fourth argument for nested data, `{ getSubRows, setSubRows }` (`setSubRows(row, children)` returns a copy of `row` with those children), and copies along the path from the top-level row to the edited one (my call: a generic helper can't rebuild a parent's children array without being told how). Without it, a nested child's edit throws a clear error instead of returning `data` unchanged. header-menu and export need no change.
- Detail panels: work on any row. The detail chevron column and the tree toggle are separate controls.
- Pinned rows: no tree.
- The wrappers: regenerated (`pnpm --filter … generate` after building `argus-table`). The React generator types `getSubRows` etc. like other function properties.

### Step 2: children from the server

Additions to `DataSource<TData>`:

```ts
interface DataSource<TData> {
  getRows(request: RowsRequest): Promise<RowsResponse<TData>>; // top-level rows, as today
  pageSize?: number;
  /** Whether a row has children to load; without it, no row has. */
  hasChildren?(row: TData): boolean;
  /** Loads all children of a row, with the current sort and filters. */
  getChildren?(request: ChildrenRequest<TData>): Promise<ChildrenResponse<TData>>;
}
interface ChildrenRequest<TData> {
  parent: TData;
  parentId: string;
  sorting: SortState;
  filters: ColumnFilterState;
  quickFilter: string;
  signal: AbortSignal;
}
interface ChildrenResponse<TData> {
  rows: readonly TData[];
}
```

Shapes decided; names to confirm. `getRows` keeps returning top-level rows only (its `start`/`end` count top-level rows). `ChildrenRequest` deliberately has no range, so `start`/`end` can be added later for paged children without breaking anything.

- Expanding a row with `hasChildren` true and no loaded children calls `getChildren`. Until it resolves, one skeleton row shows under the parent (a loading row, a body row with the loading state the table uses for unloaded rows today). A rejection shows a row with a Retry button, as failed pages do, and fires `argus-load-error` (its detail gets an optional `parentId`; `start`/`end` describe the parent's position, details in the plan).
- Children are cached per parent id until the source, sort, filters or quick filter change, or `refresh()`; then the expanded rows' children load again (only the expanded ones still shown). Collapsing keeps them.
- Children can have children: `hasChildren` and `getChildren` apply at every level.
- The shown order is the top-level rows from the page cache with each expanded parent's children spliced in after it. Core needs a mapping between that order and the top-level page cache's indexes (open parents and their shown descendant counts; binary search like `DisplayRows`, O(log k)). Data-source requests (`getRows`) keep asking for top-level ranges: the visible range is converted to the top-level rows it covers.
- Sorting and filtering in this mode happen on the server, at every level, as today. The server decides which rows a filter keeps at each level (it should return the ancestors of matches, as the client does). **Step 1's rule that ancestors of matches show expanded during a filter doesn't apply with a `dataSource`**: the table can't know which collapsed rows hold matches without loading their children, so expansion stays `treeExpanded` (my call). A later addition can let the server mark rows to show open while filtering (for example an optional `DataSource` member), without breaking anything.
- Branch selection: covers loaded children (see [Selection](#selection)).

### Row grouping later

Grouping should be able to produce its group rows as **parents in this tree**: synthetic rows (a group key and aggregates, not rows of `data`) whose children are the data rows in the group. What this design must leave room for: the flat tree structure can hold rows that aren't in `data` (a kind flag per row, or a separate range of indexes), and the tree column/toggle/keyboard/selection code shouldn't assume a parent is a data row. Nothing is built for grouping now.

## Performance

- No tree: no measurable change (benchmark at 100k and 1M within noise, `pnpm size` the only cost).
- 1M rows in a tree (the playground gets a `tree=<depth>` or similar variant, and the benchmark a variant like `detail=100`): the scroll scenarios pass the gate in all three engines.
- Expanding or collapsing one row at 1M rows: under 50 ms to the painted frame in Chromium (step 3 of the pipeline only, O(shown rows) at worst). Builder's choice whether to make it incremental.
- Building the tree structure: O(n), once per data identity; under 100 ms at 1M rows in Chromium.
- Sorting a 1M-row tree: no slower than sorting 1M flat rows today plus the layout pass.

## Testing

- Core (Node): flattening (nested and flat, default ids, missing parents, cycles), filtering with ancestors, sorting within siblings, collapse, the filter-shows-ancestors rule, branch selection's id sets, step 2's position mapping.
- Table (browser, all three engines): toggles, keys, focus on collapse, ARIA attributes, selection modes, panels on child rows, column virtualization, RTL, `getState()`/`setState()`, events controlled and uncontrolled.
- e2e (Playwright, all engines): a large tree in the playground, expand/collapse, keyboard, scrolling.
- Storybook: a Tree rows story (play function, axe). Docs site: a feature page with four flavours per example (HTML, React, Vue, Angular), per `apps/docs/README.md`.
- Step 2: a pretend server in the playground and docs examples, loading and failure states.

## Also to update

- `skills/argus-table-integrate`: `gaps.md` (tree-data stops being a gap: step 1 covers client trees; lazy trees after step 2), the migrate references' `tree-data` rows (`fit`), `scripts/lib/api.mjs` and `references/api.md` (new properties, event, `DataSource` members), `libraries.mjs` (their `fit`), so `nx test skills` passes.
- Themes (`packages/themes`): the toggle and indent in each shipped theme; the theme creator's catalog and the `argus-table-theme` skill's `draft.mjs` / references if a new token or part option is added.
- CLAUDE.md: the architecture section (the pipeline's tree steps, the tree column).
- An ADR (0013) recording the decision (approach A, `treeExpanded` separate from `expanded`, indexes count shown rows), written with step 1.

## Left to the builder

- Data structures (typed arrays for parent/depth, incremental collapse), and how the pipeline's memoization is split.
- Exact names of labels, parts and the token, subject to the plan's API review.
- Whether the toggle's indent is padding on the cell or an element, as long as there's one documented way to restyle it.
- How Enter on a tree cell interacts with the editing add-on (keep editing working).
- The step-2 position mapping's structure, the loading/failed child rows' exact rendering.
- Whether `argus-load-error` gets `parentId` or a separate event for failed children (one documented way).

## Calls made in this design (to check)

- Row indexes: top-level and flat rows keep their index in `data`; nested children get indexes from `data.length` on, in depth-first order.
- Two new plugin host members (a row's depth, the row at a source index); formulas reads rows through the second, in step 1.
- `filteredIndexes()` includes ancestors kept only for a matching descendant.
- `applyEdit` gets an optional `{ getSubRows, setSubRows }` argument for nested data; without it a nested edit throws.
- Branch selection: a parent's id is selected exactly when its whole branch is; ticking under a filter selects only what the filter keeps; select-all covers whole branches; a contradicting controlled value is shown as is.
- With a `dataSource`, ancestors of matches don't open by themselves while filtering.
- Filtering keeps ancestors of matches but not descendants of matches.
- While filtering, ancestors of matches show expanded without changing `treeExpanded`.
- The first data column is the tree column; no option yet.
- Rows with a missing parent or in a cycle become top-level, with a warning.
- Select-all without branch selection covers shown rows only; children loaded later under a branch-selected row join the selection.
- `scrollToRow({ id })` doesn't expand ancestors.
- Step 2 loads all of a parent's children per request; no paging.
- Both nested (`getSubRows`) and flat (`getParentId`) data are supported.
