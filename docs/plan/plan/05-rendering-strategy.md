# Rendering strategy

[← Back to contents](../README.md)

The table renders as a div-based CSS grid with ARIA grid roles, not a native `<table>`, because a `<table>` needs every row in the DOM to size its columns.

## Layout

- One scroll container; header, body and footer share the same column template (`grid-template-columns` from TanStack column sizes).
- Rows positioned with `transform: translateY()` from the virtualizer; a spacer sets total scroll height.
- Body row DOM is pooled: each rendered row holds a pool slot, and a row entering the window reuses the DOM (and the slots) of one that left. Keying rows by row id was measured at 2–17× slower ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)).
- Column virtualization only for wide tables (e.g. more than 30 columns); off by default (`virtualize-columns`). It works like the rows: the scrolling columns in view plus two on each side render, from a window of one size (`columnWindow` in core, on top of `steadyWindow`), and columns hold pool slots (`RowPool`), so a column scrolling in updates the cells, slots and light-DOM content of one that scrolled out in place. Cells are then in pool order, each placed explicitly in the row's one grid row and its column (`grid-area: 1 / colIndex`: a cell given only its column would be auto-placed in a new grid row whenever it follows a cell of a later column); every column keeps its track in `grid-template-columns`, so `fr` tracks still resolve and a cell kept far out of view sits at its real position (`scrollIntoView` works on it). A spike measured the per-row grid cost: with 40 pooled rows of 30 placed cells, a frame rewriting every cell took 6 ms at 500 tracks, 9 ms at 2,000 and 16 ms at 5,000 in Chromium (flat in Firefox and WebKit), against 85 ms for 500 columns all rendered; real scrolling relayouts only the recycled rows. Kept columns (rendered wherever they are): pinned ones, the checkbox column, the active cell's, a dragged one, `auto` widths still to measure, `autosizeColumns()` targets, and the first data column with a `dataSource`.

## Fixed columns

- Pinned cells stay in their rows. Header cells are `position: sticky`, with `inset-inline-start` / `inset-inline-end` offsets from TanStack v9, which pins by logical position (`column.getStart('start')`, `getAfter('end')`). Logical properties make RTL work.
- Body cells are sticky only while the table scrolls sideways. At rest, and while scrolling up and down, they're shifted by the horizontal scroll offset with a `transform`, because a sticky cell per row made Safari stutter ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md#addendum-pinned-columns-in-safari-phase-1)).
- Pinned columns are always rendered, even when column virtualization is on.
- The pinned cell next to the scrolling columns gets the public `cell-pinned-edge` part, which themes target. The `--argus-pinned-shadow` edge is drawn once per pinned side by an overlay over the scroller, not per row. A private `data-pin="start|end"` attribute marks pinned cells; themes don't use it.

## Fixed rows

- Top and bottom pinned rows (`pinnedRows`) render in two sticky row groups outside the virtualized body: the top group sticks below the header (one row tall), the bottom group to the bottom of the view. They aren't pooled, so they never get recycled. The groups keep their space in the flow, so body row *i* still starts *i* rows below the top group and the virtualizer needs no offset; scroll margins on the body cells cover the header and pinned rows (and on the scrolling cells, the pinned columns), so focus scrolls body rows clear of them. Not `scroll-padding` on the scroller: Chromium and WebKit measure the sticky rows against it too, and focusing one scrolled the body.
- Pinned-row content is slotted from the light DOM like body cells, with its own private slot names. Pinned columns inside pinned rows use the same hybrid as body rows (transform at rest, sticky while scrolling sideways); it's a handful of cells.
- The header is a fixed row with its own part names.

## Column widths

- Width modes per column: fixed px, `min`/`max` bounds, `flex` share of remaining space, `auto`.
- `auto` measures the header, the pinned rows and the rendered body rows (visible plus overscan), once the first loaded rows render, then keeps the width. Each cell is set to `inline-size: max-content` for one synchronous layout read (a private `data-measure` attribute), so every kind of content is measured the same way and nothing is painted in between. A canvas path for text-only columns was dropped: it would need a second code path and can disagree with the DOM (font features, letter-spacing).
- Double-click on a resize handle = fit to the currently rendered rows; `autosizeColumns(ids?)` does it for several. Both are resizes (`columnSizing`, `argus-column-resize`); the `'auto'` width itself is not state.
- Resizing uses TanStack `onChange` mode with `requestAnimationFrame` batching; widths can be persisted by the host via an event.

## Infinite loading

- Virtualization and data loading are separate. A `dataSource` returns pages: `getRows({ start, end, sorting, signal }) → { rows, total? }`, with `end` exclusive. (A `filter` field joins once the table filters.)
- Unknown `total` grows the scroll height as pages arrive: one page of skeletons sits below the last loaded row, and a short page marks the end.
- Rows not loaded yet render as skeleton placeholders; requests wait for 50 ms of quiet and are cancelled with `AbortController` when they scroll away.
- With a `dataSource`, sorting runs on the server (passed to `getRows`); with `data`, client-side (TanStack row models). Remote rows bypass TanStack's row models; it still handles columns, pinning, sizing and sort state.

The full loading flow is in [Code architecture: Infinite loading](../code-architecture/03-infinite-loading.md).
