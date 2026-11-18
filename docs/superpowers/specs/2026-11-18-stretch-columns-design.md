# Columns that fill the table's width: design

- **Status:** draft for review (18 November 2026).
- **Package:** `argus-table` (core model and element). Builds on core's own row model (ADR 0010) and the column widths in `create-table.ts`.

## Intent

A table whose columns add up to less than its width shows empty space after the last column: when its container grows (a window resize), or when someone drags a column narrower. The maintainer wants the columns to take the width the table gets, always, with no empty space after them.

## Goals (decided by the maintainer unless marked)

- **Wider table:** when the columns together are narrower than the table, they stretch to fill it exactly.
- **Narrower table:** columns shrink back to their own widths, never below; past that the table scrolls sideways, as today.
- **Dragging a column narrower:** the column ends where the pointer is; the freed space is spread over all the other columns.
- **Dragging a column wider:** it grows; the table scrolls once the columns are wider than it, as today. (My call: while the others are stretched, they give back their stretch first, never below their own widths: otherwise the table would scroll while showing stretched columns.)
- **A column the user has resized keeps exactly that width and doesn't stretch** (maintainer, after the builder check): only scrolling columns without a `columnSizing` entry take the free space, so a resized column always lands where the pointer is, and its saved width is what was on screen.
- **When every scrolling column has been resized,** the last scrolling column takes the free space; when that one is the column resized last (being resized, or resized most recently), the one before it does (maintainer; "most recently" added in planning, so narrowing the last column doesn't spring back on release).
- **Stretching respects `maxWidth`** (maintainer): a column at its maximum stops growing and the others get its share. If every candidate is at its maximum, the empty space stays.
- **Stretch in proportion** (my call): each stretching column gets a share of the free space in proportion to its own width.
- **State stays the columns' own widths** (my call): `columnSizing`, `getState()` and `argus-column-sizing-change` carry own widths, never stretched ones, so a saved layout fits any container.
- **Pinned columns don't stretch** (my call), nor the checkbox and chevron columns: only the scrolling columns fill the space.
- **Opt-in** (my call): a new boolean property, `stretchColumns` (attribute `stretch-columns`), default `false`. Making it the default would change every table's layout, a breaking change under ADR 0004.

## Non-goals

- Shrinking columns below their own widths to avoid sideways scrolling.
- Changing `{ flex }` columns: with stretching on, unresized flex columns still take the free space through their grid tracks (so there is none left to stretch into); once resized they have own widths and stretch like the rest (my call).
- Anything for pinned-only tables (no scrolling columns: nothing stretches).

## Anti-goals

- With `stretchColumns` off, nothing changes: layout, widths, events and every existing test.
- No state writes or change events from a window resize.
- No work while scrolling: the table re-renders only when its width changes.
- No horizontal scrollbar from rounding: stretched widths sum to the available width exactly, in whole px.

## Approaches (the maintainer picked B)

- **A. Grid tracks stretch (`minmax(Wpx, Wfr)`).** The browser fills the width with no work on resize, but the table no longer knows its columns' pixel widths: column virtualization, `scrollToColumn()`, pinned offsets, Alt+Arrow and reorder drags all read model widths, and `{ flex }` columns already need workarounds for that.
- **B. Core computes the stretched widths in px (picked).** The element measures the scroller's width and passes it to the model; the model computes each column's stretched width; tracks stay plain px. Everything that reads widths keeps working; the drag inversion is arithmetic in core, tested in Node. Cost: an update per frame of a width change.
- **C. Rescale `columnSizing` on resize.** Rejected: fires change events on every window resize and saves stretched widths.

## The model (core, `create-table.ts`)

- New option `stretch: { width: number; keep?: string } | undefined`: the scroller's `clientWidth` (floored), set by the element only while `stretchColumns` is on, and `keep`, the id of the column the user resized last (kept by the element until another column is resized; not state).
- **Own width** stays what `widthOf()` returns today (sizing state or definition, clamped). **Rendered width** = own width + share. With stretching on and no unresized `{ flex }` column among the shown scrolling columns:
  - `free = width − Σ own widths of every shown column (pinned and system columns included)`. Nothing happens unless `free > 0`.
  - **Who stretches:** the shown scrolling columns without a `columnSizing` entry (never `stretch.keep`). If there are none: the last shown scrolling column, or the one before it when the last is `stretch.keep`.
  - **How much:** `free` spread over them in proportion to their own widths, each capped at its `maxWidth`, with a capped column's excess handed to the rest (core's `spreadWidth` in `columns/` does this kind of spreading). Whole px; the px left over by rounding go one each to the stretching columns from the last backwards, so the sum is exact unless every one is capped.
- `ColumnView.width` is the **rendered** width (offsets, `totalWidth`, tracks and everything downstream use it). New `ColumnView.ownWidth`: the own width.
- The model's key for memoized views includes `stretch.width` and `stretch.keep`.

## The element (`argus-table.ts`, controllers)

- `@property({ type: Boolean, reflect: true, attribute: 'stretch-columns' }) stretchColumns = false`, JSDoc for the manifest.
- The scroller's width: `PinScrollController` already observes the scroller's size (`measure()`); it reports `clientWidth` to the element, which requests an update only when the floored width changed and `stretchColumns` is on.
- **Resizes** (`ColumnResize`): a drag, Alt+Arrow or a group resize starts from the column's **rendered** width (`view.width`, or the last width it requested while keys repeat), so a stretched column doesn't jump when it's grabbed; the width requested is stored as its own width (it no longer stretches). The element sets `stretch.keep` to the column when a resize of it starts and keeps it until another column is resized. Double-click / `autosizeColumns()` measure content: stored as is.
- Events: `argus-column-sizing-change` and `argus-column-resize-end` carry own widths (the state), as now.
- `PluginHost.columns()`' `ColumnInfo.width`: the rendered width, as the table shows it (my call; matches what's on screen, and the export add-on's Excel widths follow the screen).

## Docs and tooling

- Docs: the Resizing page gets a "Columns that fill the width" section with an example in four flavours and its e2e (`since` the next minor).
- A Storybook story (Features / Resizing) with a play function.
- Wrappers: regenerate the React, Vue and Angular files (new property); the integrate skill's `api.mjs` and `references/api.md`; `CLAUDE.md` (a paragraph under column widths); a changeset (`argus-table` minor, wrappers in the fixed group).
- Size: the CDN budget (46 kB, now 45.63 kB) may need a raise; ask with numbers.

## Left to the builder

- Internal names (besides the public property), where exactly the width enters the model's options.
- How tests force a container width (a sized fixture is enough).
