# Rendering strategy

[← Back to contents](../README.md)

The table renders as a div-based CSS grid with ARIA grid roles, not a native `<table>`, because a `<table>` needs every row in the DOM to size its columns.

## Layout

- One scroll container; header, body and footer share the same column template (`grid-template-columns` from TanStack column sizes).
- Rows positioned with `transform: translateY()` from the virtualizer; a spacer sets total scroll height.
- Body row DOM is pooled: each rendered row holds a pool slot, and a row entering the window reuses the DOM (and the slots) of one that left. Keying rows by row id was measured at 2–17× slower ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)).
- Column virtualization only for wide tables (e.g. more than 30 columns); off by default.

## Fixed columns

- Pinned cells stay in their rows. Header cells are `position: sticky`, with `inset-inline-start` / `inset-inline-end` offsets from TanStack v9, which pins by logical position (`column.getStart('start')`, `getAfter('end')`). Logical properties make RTL work.
- Body cells are sticky only while the table scrolls sideways. At rest, and while scrolling up and down, they're shifted by the horizontal scroll offset with a `transform`, because a sticky cell per row made Safari stutter ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md#addendum-pinned-columns-in-safari-phase-1)).
- Pinned columns are always rendered, even when column virtualization is on.
- The pinned cell next to the scrolling columns gets the public `cell-pinned-edge` part, which themes target. The `--argus-pinned-shadow` edge is drawn once per pinned side by an overlay over the scroller, not per row. A private `data-pin="start|end"` attribute marks pinned cells; themes don't use it.

## Fixed rows

- Top and bottom pinned rows render in sticky containers outside the virtualized range, so they never get recycled.
- The header is a fixed row with its own part names.

## Column widths

- Width modes per column: fixed px, `min`/`max` bounds, `flex` share of remaining space, `auto`.
- `auto` measures header plus a sample of rows (first N loaded, default 50). Text-only columns can use `canvas.measureText` for speed.
- Double-click on a resize handle = fit to the currently rendered rows.
- Resizing uses TanStack `onChange` mode with `requestAnimationFrame` batching; widths can be persisted by the host via an event.

## Infinite loading

- Virtualization and data loading are separate. A `dataSource` returns pages: `getRows({ start, end, sorting, signal }) → { rows, total? }`, with `end` exclusive. (A `filter` field joins once the table filters.)
- Unknown `total` grows the scroll height as pages arrive: one page of skeletons sits below the last loaded row, and a short page marks the end.
- Rows not loaded yet render as skeleton placeholders; requests wait for 50 ms of quiet and are cancelled with `AbortController` when they scroll away.
- With a `dataSource`, sorting runs on the server (passed to `getRows`); with `data`, client-side (TanStack row models). Remote rows bypass TanStack's row models; it still handles columns, pinning, sizing and sort state.

The full loading flow is in [Code architecture: Infinite loading](../code-architecture/03-infinite-loading.md).
