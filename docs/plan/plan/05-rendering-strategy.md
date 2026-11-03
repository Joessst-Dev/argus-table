# Rendering strategy

[← Back to contents](../README.md)

The table renders as a div-based CSS grid with ARIA grid roles, not a native `<table>`, because a `<table>` needs every row in the DOM to size its columns.

## Layout

- One scroll container; header, body and footer share the same column template (`grid-template-columns` from TanStack column sizes).
- Rows positioned with `transform: translateY()` from the virtualizer; a spacer sets total scroll height.
- Column virtualization only for wide tables (e.g. more than 30 columns); off by default.

## Fixed columns

- `position: sticky` with `inset-inline-start` / `inset-inline-end` offsets from TanStack (`column.getStart('left')`, `getAfter('right')`). Logical properties make RTL work.
- Pinned columns are always rendered, even when column virtualization is on.
- The pinned cell next to the scrolling columns gets the public `cell-pinned-edge` part, which themes target, and draws the `--argus-pinned-shadow` edge. A private `data-pin="start|end"` attribute tells the component which way to point the shadow; themes don't use it.

## Fixed rows

- Top and bottom pinned rows render in sticky containers outside the virtualized range, so they never get recycled.
- The header is a fixed row with its own part names.

## Column widths

- Width modes per column: fixed px, `min`/`max` bounds, `flex` share of remaining space, `auto`.
- `auto` measures header plus a sample of rows (first N loaded, default 50). Text-only columns can use `canvas.measureText` for speed.
- Double-click on a resize handle = fit to the currently rendered rows.
- Resizing uses TanStack `onChange` mode with `requestAnimationFrame` batching; widths can be persisted by the host via an event.

## Infinite loading

- Virtualization and data loading are separate. A `dataSource` returns pages: `getRows({ start, end, sort, filter }) → { rows, total? }`.
- Unknown `total` grows the scroll height as pages arrive.
- Rows not loaded yet render as skeleton placeholders; requests are debounced and cancelled with `AbortController` on fast scroll.
- Sorting/filtering can run client-side (TanStack row models) or server-side (passed to `getRows`).

The full loading flow is in [Code architecture: Infinite loading](../code-architecture/03-infinite-loading.md).
