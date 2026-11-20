# Row grouping

Status: design, 20 November 2026. Builds on the row-structure refactor (#197, #198) and its perf follow-ups (#199).

## Why

Row grouping is one of the two "hard gaps" in the integrate skill (`skills/argus-table-integrate/references/gaps.md`, `HARD_GAPS` in `scripts/lib/libraries.mjs`): when a screen in AG Grid, MUI X, TanStack Table, PrimeNG/PrimeVue, Vuetify or Element Plus groups rows, the skill tells people to keep the old table on that screen. The aim is to turn "keep the old grid" into "migrate it", so the first version covers what a typical grouped screen in those libraries uses, and no more.

ADR 0013 already fixed the shape: group rows are synthetic parents in the tree, rows not in `data`. #198 made a row arrangement one `RowStructure` (`model.rows`), so grouping is a new implementation, not a branch in each caller.

Who it's for: app developers migrating grouped screens, and their users, who open and close groups, read totals per group, and change what's grouped from the column menu.

## Goals

- Group body rows by the values of one or more columns, for local `data` and for a `dataSource`.
- Group rows show the group's value and its row count, open and close like tree rows (keys, ARIA, open state), and nest (several levels).
- Per-column totals on group rows: sum, average, min, max, count, or the app's own function.
- Users change grouping from the column menu ("Group by this column", "Ungroup").
- With a `dataSource` the server groups, counts and totals, and groups and the rows in them load page by page.
- Grouped export (Excel outline rows, CSV, PDF).

## Non-goals

- A drag-to-group panel (AG Grid's row group panel).
- Pivoting.
- A grand-total row: `pinnedRows.bottom` already does that.
- Editing or selecting a group row itself. Ticking a group's checkbox selects its rows (as branch selection does today); the group's own id is never in `selection`.
- Grouping combined with tree rows (`getSubRows`, `getParentId`, or a data source's `hasChildren` / `getChildren`).
- Expand-all / collapse-all controls (an app can set the open ids itself).

## Anti-goals

- **A slower table without grouping.** No grouping branch may run per row or per cell when `grouping` is empty; the hot paths of #198's design doc (`stateAt`, `idAt`, `treeRow` per row, `cellContext` per cell) keep their cost. A grouped table may not cost more per rendered row than a tree with the same shape.
- **A public row-order hook.** ADR 0011 and 0013 turned it down; grouping is in core, not an add-on over a hook (the maintainer chose this, 20 November).
- **A breaking change.** 1.0's compatibility policy (ADR 0004): additions only. No existing property, event, part or type changes meaning for a table that doesn't group.
- **Per-group sort functions.** Like tree rows: one global sort, so radix sorting and one sort function per column hold (ADR 0013).
- **Loading a whole group at once from a server.** A group can hold tens of thousands of rows.

## Constraints

- **Size.** The CDN bundle is 55.98 of 56 kB. The maintainer approved raising the budget to about **61 kB** for grouping (estimate: ~2.5 kB local grouping and totals, ~2 kB remote paging under groups, plus rendering). Set the new limit at the measured size plus a little headroom, at most 61 kB; each PR states `pnpm size` before and after. The column-menu item goes into `@argus-table/header-menu` and grouped export into `@argus-table/export`, each within their own budgets (raise those only with approval).
- **Hot paths**, as above. Read `model.rows` once per render; no allocation per cell.
- **Public API is a contract.** Every new property, event, part, label and type below is an addition under ADR 0004, documented in JSDoc (CEM), the wrappers regenerated, and the integrate skill's `api.mjs` / `references/api.md` updated (`nx test skills` checks).
- **No hard-coded text**: group-row text (the count, the empty group's name, toggle labels) and the column-menu items go through `TableLabels` / `HeaderMenuLabels`, with German text in the Labels story.
- Everything works in Chromium, Firefox and WebKit, keyboard and screen reader included.

## Approaches (decided)

1. **Everything in the table, budget raised to ~61 kB (chosen).** Grouping lives in core as a new row structure, plus paging under groups for data sources; the menu item and grouped export go into their add-ons. Simplest to build and test, and what #198 prepared for. Every page loading the table carries the bytes, grouped or not (~+9%, like the tree-rows raise from 52 to 56 kB).
2. **A lazily loaded grouping chunk inside `argus-table`.** Tables that never group pay nothing, but the first grouped render waits for the chunk (ungrouped rows or a loading state first), the CDN build becomes two files, and the remote paging would sit outside the main file, splitting the data-source tree code in two. More moving parts and harder to change.
3. **A grouping add-on over a public row-structure hook.** Needs the hook ADR 0011 and 0013 rejected; it would freeze the row model's internals under 1.0's rules. Ruled out.

## What users and apps see

### Grouping state

- New property `grouping: GroupingState` (`readonly string[]`, column ids in level order; `[]` or unset = no grouping). Controllable like `sorting` (`controllable()`), event `argus-grouping-change` with `{ grouping, columnId }` (the column added or removed), in `TableState`, `getState()` and `setState()`.
- Ids of columns that don't exist, are listed twice, or aren't `groupable` are ignored (as unknown ids are elsewhere).
- New `ColumnDef.groupable?: boolean` (default `false`, opt-in like `sortable`), and `<argus-column groupable>`. The model ignores ids of columns that aren't `groupable`, so it gates the property, the column-menu item and `PluginHost.setGrouping` alike. _(My call: one rule is easier to explain than "the menu checks it but the property doesn't".)_
- A grouped column stays shown where it is. The group's value shows in the tree column (the model's first data column, as for tree rows).
- With tree rows (`getSubRows`, `getParentId`, or `hasChildren` + `getChildren`) and `grouping` both set, grouping is ignored with one console warning. _(My call: the tree is the data's shape, grouping a view of it.)_

### Group rows

- A group row's id is made by the table from its path (each level's column id and value), deterministic, distinct from any row id (a reserved prefix, as stand-in ids use `\u0000`), and plain JSON so it survives `getState()`. Its exact format is documented in the `grouping` JSDoc so an app can open groups itself. _(Format is the builder's; the requirements are mine.)_
- Open groups are in **`treeExpanded`** (same property, same `argus-tree-expanded-change` event, same toggle path): group rows are tree parents, and grouping and tree rows never combine, so one open-state property serves both. Groups start closed. Saved open ids keep working while the values exist. _(My call: a second `groupExpanded` property would duplicate the toggle path #197 just unified.)_
- Rendering: one body row. The tree column's cell has the indent, the toggle, the group's value (formatted like the grouped column's default cell text, `formatValue`) and the count (label `groupCount({ count })`, e.g. "(12)"). The other columns' cells show the column's total, if it has one (formatted with `formatValue`), else nothing. A new optional `ColumnDef.groupCell?(context: GroupCellContext) => TContent` lets a column render its group-row cell itself (the grouped value in the tree column, its total elsewhere); `GroupCellContext` holds `rowId`, `index`, `columnId`, `depth`, `count`, `groupColumnId`, `value` (the grouped value) and `total` (this column's total). Group rows never call `cell` (it takes a `TData` row). _(My call: without it, apps couldn't format currency totals or show a status badge on a group.)_ The wrappers get it declaratively in PR 1: React as a `groupCell` returning JSX (generated like `cell`), Vue as a `#row-group-<id>` slot (`#group-<id>` is taken by column-group headers, and Vue's slot types can't tell `#group-cell-…` from it), Angular as `ng-template[argusGroupCell]`. _(My call on the names.)_
- The empty group (values `undefined`, `null`, `''`, invalid dates) is one group named by the label `emptyGroup` ("(empty)"), sorted last like `undefined`.
- Values group by equality of the accessor's value (SameValueZero; `Date`s by time).
- New part `row-group` on group rows (and `cell-group` on their cells), so themes can style them; each shipped theme gets a modest default (e.g. the header's weight). Parts are API: add them to the JSDoc.
- ARIA: the host is `treegrid` while grouped; group rows get `aria-level`, `aria-expanded`, `aria-setsize`, `aria-posinset` like tree rows, and their cells `aria-readonly`.

### Interaction

- Keys: on the tree column, as tree rows (toward the end opens, toward the start closes or moves to the parent). **Enter on a group row toggles it** (it has no click events to fire). _(My call: AG Grid does the same, and Enter otherwise does nothing there.)_
- Clicks: a group row fires no `argus-row-click` / `argus-cell-click` (their details carry a `TData` row). A click on its toggle toggles; a click elsewhere makes the cell active.
- Selection (multi mode with checkboxes): a group row's checkbox ticks every row in the group the filters keep (locally) or every loaded row in it (data source), with the indeterminate state from branch selection; the group's id is never selected. This holds whether `selectBranches` is on or not: grouping never combines with tree rows, so data rows have no children and `selectBranches` changes nothing in a grouped table; select-all selects every kept data row, and Shift-ranges skip group rows' ids, as they skip unknown ids today. Single mode: group rows aren't selectable. _(My call: a group checkbox that did nothing without `selectBranches` would be a trap.)_
- Detail rows: group rows never get a panel; data rows inside groups can.
- Sorting: groups are ordered by their value; a sort on another column orders the rows inside each group. Sorting by a column with a total also orders the groups by that total (what "sort by revenue" means to users). With a `dataSource` the server orders everything.
- Filters apply to data rows; counts and totals cover the rows that pass; a group with none left disappears.
- `scrollToRow`, `getState().scroll`, `argus-range-change`: shown indexes, group rows counted, as for tree rows. `scrollToRow({ id })` for a row inside a closed group does what it does for a row under a collapsed tree row.
- Editing (`@argus-table/editing`): group-row cells are never editable.
- Formulas: formula columns can be grouped and totalled locally; with a `dataSource` only where they're sortable (`server: true`).

### Totals

- New `ColumnDef.aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count' | ((values: readonly unknown[], context: { rowIds: readonly string[] }) => unknown)`. Built-ins read numbers (numbers, and numeric strings like the number filter does; others skipped); `min`/`max` also take dates; `count` counts non-empty values. A total covers every data row under the group (nested groups included), filters applied. Computed locally only: with a `dataSource` the server sends totals.

### Column menu (`@argus-table/header-menu`)

- "Group by this column" on a `groupable` column not in `grouping` (appends it as the innermost level), "Ungroup" on one that is. Through new `PluginHost` members `grouping()` and `setGrouping(next)` (required members; adding them isn't breaking). A `headerMenu({ group: false })` option turns the items off, like the others.

### Export (`@argus-table/export`)

- Group rows are written with their value, count and totals: Excel as outline rows (outline level per depth), PDF as indented bold rows, CSV as rows with the value in the first column. Exports what the table shows (closed groups' rows included, since an export is of the data, not the view). With `allRows` and a `dataSource`, top-level groups and their totals only. If this turns out costly it ships as a follow-up PR after the rest (the maintainer agreed).
- Plugins need to tell a group row from a data row and read its value, count, depth and totals: add a required `PluginHost` read member for it (the builder names it).

### With a `dataSource`

- When `grouping` is non-empty, `getRows` is asked per level. `RowsRequest` gains `grouping: readonly string[]` (`[]` without grouping, so existing sources can ignore it) and `groupPath: readonly { columnId: string; value: unknown }[]` (the group being filled; `[]` at the top). `start` / `end` count the rows of that level.
- Above the deepest level the response carries `groups: readonly GroupData[]` instead of `rows`; `GroupData` is `{ value: unknown; count: number; totals?: Record<string, unknown> }` (`count`: data rows under the group, nested levels included). At the deepest level it carries `rows` as today. `total` is that level's count (groups or rows). A response of the wrong kind fails that page (shown as failed, `argus-load-error`). Group values must be JSON values (they go into ids and `groupPath`).
- Every level pages: top-level groups, the groups inside an open group, and the rows inside an open group, each loaded as it scrolls into view, with the existing loading rows, failed rows and Retry, debouncing and aborts. Pages far from view are dropped (as top-level pages are today), at every level.
- An open group at the deepest level knows its size from its `count` before its rows load, so indexes below it don't move as its pages load. An open group above that level doesn't know how many groups it holds until its first page answers with that level's `total`: until then it shows one loading row (as a data-source tree's parent does), so indexes move once when that page arrives, with `aria-setsize` `-1` for that level meanwhile. _(My call: no extra count field in `GroupData`, so servers needn't count distinct subgroups; the stand-in ids and placeholder machinery `RemoteTree` already has cover the one move.)_
- Data rows inside groups without `getRowId` get ids from their group's id and their index in it (as `RemoteTree` names children `${parentId}.${i}`), so their ids, and with them selection, change when the grouping changes. The docs recommend `getRowId` for grouped data sources. _(My call.)_
- A new source, sort, filters, quick filter, `grouping` or `refresh()` starts over; open ids stay in `treeExpanded` and reopen as their groups arrive.
- `argus-load-error` for a page inside a group: `start` / `end` as shown indexes, plus `groupPath`? The builder decides the detail's shape within ADR 0004 (an added optional field).

## How it's built (decided)

- **Core, local:** a grouping step in `RowPipeline` after filtering: bucket the kept rows by the grouping columns' values (one pass per level), give group rows synthetic indexes after the source rows (ADR 0013), lay out with one global sort (rows within groups; groups by value, or by total when the sort column has one), and drop rows under closed groups (the `showOpen` step), each memoized on what it reads so opening or closing reruns only the last. A new `RowStructure` over it (or `ModelRows` extended; the builder's call) answers `tree: true`, `treeRow`, `depthAt`, `toggleId`, `mayToggle`, `shownAncestor`, `forest` (groups as parents, their ids never selectable) for group rows and data rows alike. Totals are computed per group over kept rows when the steps are built, only for columns with `aggregate`.
- **Core, data source:** a paged structure where every open group's level is its own `PageCache` (shown indexes map through open groups' known sizes with prefix sums and binary search, as `RemoteTree` does today), implementing `RemoteRows` and `RowStructure`. Whether it's a new class beside `RemoteTree` or `RemoteTree` generalized to page under parents is the builder's call; `RemoteTree`'s behaviour and its tests stay unchanged.
- **Table:** `DataController` plans page requests per level for the rendered range and builds requests with `groupPath` (the `LoadChildren` seam from #198 is where "another kind of parent brings its own request" lands; its shape may change). Rendering: group rows in `render/body.ts` / `render/cells.ts`; light-DOM content for `groupCell`. Keyboard, navigation, selection and body state should need no grouping branch beyond what group rows' missing `RowView` forces (click events, detail panels, the plugin host's row reads); name any that remain in the PR.
- **ADR 0014** records the decisions above (local + remote grouping, open state in `treeExpanded`, the `getRows` shape, the size raise).

## Delivery

Each a PR into `main`, reviewed and green before the next. Releases can go out between them, so until PR 3, `grouping` on a `dataSource` table is ignored with one console warning ("grouping with a dataSource isn't supported yet"), and the column-menu item isn't offered there; until PR 4, export writes data rows only (group rows left out). _(My call: nothing an app can switch on before PR 3 starts sending group requests to a server that doesn't expect them. Holding releases until PR 3 instead is the maintainer's option.)_

1. Local grouping in core and the table: `grouping`, `groupable`, group rows, keys, ARIA, selection, sorting and filters, totals (`aggregate`, `groupCell`), parts and labels, `getState()`; size limit raised; story, docs page (four flavours), wrappers regenerated, integrate skill updated (`row-grouping` no longer a hard gap for local grouping; the per-library `fit`s in `libraries.mjs` and `references/migrate/*.md`).
2. The column-menu items (`@argus-table/header-menu`), `PluginHost.grouping` / `setGrouping`.
3. Grouping with a `dataSource`: request and response shapes, the paged structure, `DataController`, load errors; docs and skill updated again.
4. Grouped export (`@argus-table/export`), possibly later.

## Testing

- Core (Node): grouping, nesting, empty groups, totals (each built-in, a custom function, filters applied), sorting by value and by total, open/close reruns only the last step, ids stable across sort and filter, the structure's contract suite (`row-structure.test.ts`) extended with a grouped fixture and a remote grouped fixture, paging under groups (stand-in ids, eviction, a failed page inside a group).
- Table (all three engines): rendering, keys, Enter toggles, no click events on group rows, selection by group, `treeExpanded` events, controlled `grouping`, `getState()`/`setState()`, `groupCell` with framework content (React/Vue/Angular wrappers), a grouped data source end to end (e2e, all engines).
- A Node micro-benchmark like #199's: a grouped pass costs no more per row than a tree pass of the same shape, and an ungrouped table is unchanged.
- Storybook story with axe; docs e2e per flavour.

## Left to the builder

Names (other than the public ones above, which are proposals the maintainer can still change in review); the group-id format within its requirements; how the grouping step reuses `tree-order.ts`; one structure or two for local rows; a new remote class or a generalized `RemoteTree`; how `DataController` plans requests across levels; the `PluginHost` member for group rows; the load-error detail for groups; PR boundaries inside the delivery order; theme defaults for the new parts.
