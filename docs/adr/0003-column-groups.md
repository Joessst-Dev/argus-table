# ADR 0003: Column groups as a separate model, with filler cells in per-row grids

- **Status:** Accepted (11 November 2026).
- **Builds on:** [ADR 0001](0001-shadow-vs-light-dom.md): header content is slotted light DOM, and each rendered row is its own CSS grid on the column tracks.

## Context

Users want headers over several columns ("Customer" over Name and City), nested ("Address" inside "Customer"). Every row of the table is a CSS grid on `--_cols`, and the header was one such row. Everything around the columns assumed a flat list: the `columns` property, the plugin hook `columns(defs, host)` and the four plugins that implement it (the column menu, formulas and its editor, the Vue and Angular template plugins), `<argus-column>` children, and the state records (`columnOrder`, `columnPinning`, `columnSizing`, `columnVisibility`, `columnFilters`) and their events.

## Decision

- **A separate model.** `columnGroups` lists groups (`{ id, header, columns }`, `columns` holding column ids and nested groups); `columns` stays flat. The plugin hook, the plugins, the state and the events don't change, and `<argus-column-group>` only adds a second kind of child. TanStack's nested column definitions aren't used: core already keeps TanStack internal, and a flat model is what every caller has.
- **Top-aligned levels.** A group's header row is its nesting depth; the column headers are the last header row. Header rows = the deepest nesting among the shown columns + 1, so hidden columns can remove a row.
- **Groups stay together.** The order is normalized so a group's columns are adjacent on each pin side, where its first column is. Moves are of units, a column or a group on one pin side, among the units with the same parent group on the same side. Without groups that is the old column move.
- **A group split by pinning** shows once per pin side, sticky with its columns.
- **Filler cells, not row spans.** Each header row stays a grid on every column's track. A group cell spans its columns (`grid-column: start / span n`, `aria-colspan`). Under a column without a group at a level sits a filler: an empty, unfocusable `gridcell` with `aria-colspan`, merged with its neighbours on the same side. Every header row then covers every column, so screen readers that count cells by position put each group header over its columns.
- **Group rows aren't virtualized.** There are few group cells, and each renders with a slot named by its group and side, so slot assignment never changes while scrolling (WebKit cancels a wheel scroll when it does). A group's label is sticky inside its cell, so it stays in view across a wide group.

## Options not taken

- **Nested `columns` in `ColumnDef`** (TanStack's and AG Grid's shape). Familiar, but every plugin's `columns` hook, the formula editor (which rebuilds the array for its events) and the framework template plugins would have to walk a tree, and the plugin contract would change shortly before 1.0.
- **Leaf headers spanning rows** (`aria-rowspan`, one header grid with `display: contents` rows). It looks like a spreadsheet, but rows with `display: contents` have dropped out of the accessibility tree in some engine versions, `aria-rowspan` support in screen readers is uneven, and every rule that assumes a row is a grid (pinned offsets, explicit placement with `virtualizeColumns`) would change.
- **Empty `columnheader` fillers.** Simpler to style, but a header with no name fails axe's `empty-table-header` rule and reads as a nameless header.
- **Groups that split when columns move apart** (AG Grid's default). It keeps moves free, but the same group header then shows several times, and the order no longer says what belongs together.

## Consequences

- The header is `--_header-rows` rows tall: the sticky top of pinned rows, scroll margins, page sizes and the virtualizer's cap use it.
- The active cell can be a group: header row `level`, and a column it covers, so focus returns to that column on ArrowDown.
- A screen-reader pass with groups is part of the [check](../a11y/screen-reader-check.md) (step 10). Readers may announce fillers as blank cells.
- Follow-ups: Vue `#group-<id>` slots and an Angular group template directive, resizing a group, and per-group `reorderable`.
