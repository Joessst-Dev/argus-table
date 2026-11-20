# ADR 0014: Row grouping as a tree of group rows

- **Status:** Accepted (20 November 2026): step 1, rows in memory. Grouping with a `dataSource` is step 2.
- **Builds on:** [ADR 0013](0013-tree-rows.md) (tree rows), [ADR 0010](0010-own-row-model.md) (core's own row model) and [ADR 0004](0004-api-1-0.md) (additions only). Design: `docs/superpowers/specs/2026-11-20-row-grouping-design.md`; plan: `docs/superpowers/plans/2026-11-20-row-grouping-local.md`. The row-structure refactor (#197, #198) made it a new row arrangement rather than a branch in each caller.

## Context

Row grouping was one of the integrate skill's two hard gaps: a screen in AG Grid, MUI X, TanStack Table, PrimeNG/PrimeVue, Vuetify or Element Plus that groups rows was left on the old grid. ADR 0013 already said group rows would be synthetic parents in the tree. Grouping is planned for rows in memory and for a `dataSource` (the server groups, and a group's rows load page by page); it isn't combined with tree rows. The CDN bundle was 55.98 of 56 kB.

## Decision

- **In the table's core, with the size budget raised** (the maintainer's choice, 20 November): the CDN limit goes from 56 kB to the measured size plus a little headroom, at most 61 kB for both steps. Rejected: a grouping chunk loaded on first use (an async first grouped render, two CDN files, the data-source tree split in two) and an add-on over a public row-arrangement hook (the hook ADR 0011 and 0013 turned down).
- **Grouped rows are a tree.** A grouping step after filtering (`table/group-rows.ts`, `buildGroups`) builds `GroupedRows`, the `RowTree` shape: data rows keep their source indexes `0 … n-1`, group rows follow (outermost level first), then one hidden child per group. The tree steps lay it out (`layoutTree`, `showOpen`), so keys, ARIA, `treeExpanded`, `shownAncestor`, the active cell and branch selection serve group rows unchanged. `RowStructure` gains `grouped` and `groupAt(index)`; `pipeline.shape()` is the tree the shown rows come from (the data's own, or the groups).
- **Groups exist only for rows the filters keep**: grouping runs over the filtered rows, so empty groups vanish and counts and totals cover what passes; nothing is forced open by a filter.
- **Sorting is one global sort** over the kept data rows and the group rows, with a group row's key its value in its own column and its total in a totalled one, then bucketed by parent: groups follow their values by default (created in value order, the empty group last), rows sort within their group, and sorting by a column with an `aggregate` orders the groups by their totals.
- **Ids from values.** A group's id is `'\u0000g'` plus the JSON of its path (column ids and keys: dates as their time, empty values `null`), so open groups survive sorting, filtering and new `data`, and an app can name them.
- **Open groups are `treeExpanded`.** Grouping never combines with tree rows, so one open-state property, event and toggle path serve both.
- **A group's own id is never selected.** Its hidden child stays unselected, so the branch rules never add the group's id (the trick a data-source tree uses under a server filter); the checkbox marks treat group rows as checked when their rows are. Grouped tables always select by branch in `multi` mode, `selectBranches` or not (data rows have no children there).
- **Group rows have no row object**: `rowAt`, `valueAt` and `cellContext` return `undefined`, so click events, detail panels and editing skip them without a branch; `ColumnDef.groupCell` renders their cells, and Enter toggles them.
- **Public API (additions):** `grouping` (controllable, `argus-grouping-change` with `columnId`, in `TableState`), `ColumnDef.groupable` / `aggregate` / `groupCell`, the types `GroupingState`, `ColumnAggregate`, `GroupRowInfo`, `GroupCellContext`, `GroupingChangeDetail`, the parts `row-group`, `cell-group`, `group-count`, the labels `groupCount` and `emptyGroup`, and `PluginHost.grouping()`, `setGrouping()`, `group()` and `groupedRows()`. The wrappers: React `groupCell` JSX, Vue `#row-group-<id>` slots (`#group-<id>` is the column groups' and Vue's slot types can't tell the two apart), Angular `ng-template[argusGroupCell]`.

## Consequences

- An ungrouped table does no grouping work per row or per cell: renderers read `rows.grouped` once per render.
- Grouping with a `dataSource` is ignored with a warning until step 2, so no server gets group requests it doesn't expect.
- Export writes every data row of a grouped table in grouped order (`groupedRows()`), closed groups' too; group rows themselves come with grouped export later.
