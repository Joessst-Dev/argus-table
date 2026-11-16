# ADR 0008: Own row virtualization, without TanStack Virtual

- **Status:** Accepted (16 November 2026).
- **Builds on:** [Rendering strategy](../plan/plan/05-rendering-strategy.md) (row heights, scroll scaling) and [ADR 0001](0001-shadow-vs-light-dom.md) (pooled rows, the steady window).

## Context

`VirtualController` used TanStack Virtual (`@tanstack/lit-virtual`, `@tanstack/virtual-core`) for fixed row heights. Over v0.2 to 1.2 the controller took over most of its work:

- **Measured heights** (`rowHeight: 'auto'`): TanStack's measuring recomputes every offset below a measured row (14–23 ms per frame near the top of 1M rows), so in that mode the virtualizer got `count: 0` and the controller did the window itself from core's `RowSizes`, with its own scroll listener and `ResizeObserver`.
- **Scroll scaling:** past the engines' maximum element height the virtualizer saw a `Proxy` stand-in for the scroller with logical `scrollTop`, `scrollHeight` and `scrollTo()`.
- **The steady window** (core `steadyWindow`) replaced its range through `rangeExtractor`, and the row pool decides the DOM.
- **Focus and alignment** (`reveal`, `scrollToIndex` with `align` and insets) were the controller's own for measured heights and scaled bodies.

What was left to TanStack Virtual: the range for fixed heights, and `scrollToIndex(index, { align: 'start' })`. It kept that command for a few frames and finished it when the row count changed, which moved rows after the user had taken over a restored scroll (#110, fixed by cancelling it on input). The element already follows a data source's growing row count itself (`#scrollTarget`).

Measuring the CDN bundle by source (its source map) put `@tanstack/virtual-core` at about 8 kB of 60.4 kB gzipped, more than any other dependency, with 140 B left under the 60.5 kB budget.

## Decision

- **`VirtualController` windows rows in both modes from `RowSizes`.** With fixed heights `configure()` resets it to `count` rows of the row height. `RowSizes` allocates nothing until a row differs from that height, so this costs O(log n) per configure and no memory. Measuring, the held correction (`#hold`), the px grid and heights by row id stay auto mode only.
- **The controller listens to the scroller** (scroll events, `ResizeObserver`) in both modes and requests an update when the visible rows change. A scaled body also re-renders on every scroll: its rows render relative to the scroll position, and TanStack only re-rendered on a new range and when scrolling stopped, so rows drifted by part of a row in between. `reveal()` marks the next scroll to re-render even when the visible rows are the same, so focus follows it.
- **`scrollToIndex()` writes the offset once**, for every `align`. Following a data source past the rows counted so far stays with the element (`#scrollTarget`, dropped on the user's input), so nothing is left pending; `cancelScroll()` is gone.
- **Offsets are logical inside the controller** (`#top()`, `#write()`); the `Proxy` stand-in is gone with the virtualizer that needed it.
- **The controller requests an update when the host reconnects**, as `lit-virtual` did, so a table moved in the DOM listens to its scroller again.
- **The CDN budget goes down to 51 kB**, from 60.5 kB, at 50.3 kB: the bytes saved stay visible, and spending them is a decision again.

## Options not taken

- **Keeping TanStack Virtual for fixed heights.** It no longer did anything the controller can't, and two code paths (one of them through a `Proxy`) meant every scrolling fix had to be made and tested twice.
- **`@lit-labs/virtualizer`.** A list virtualizer that renders and positions its own children; the table needs pooled rows in a CSS grid, sticky header and pinned rows in the same scroller, and scaling past the maximum element height.
- **Replacing `@tanstack/table-core` in the same change.** It and `@tanstack/store` are about 9 kB more, but what core still uses it for (the core row model, value caching, column resolution, sizing) is the data model, not scrolling: a separate decision if it comes.

## Evidence

- **Bundle:** `argus-table`'s CDN build 60.36 → 50.31 kB gzipped (`pnpm size`).
- **Tests:** unit tests in Chromium, Firefox and WebKit (394 + 786 passed), e2e in all three (264 passed), and the Storybook tests, unchanged.
- **Scrolling:** `pnpm bench` with `ROWS=100000,1000000 BROWSERS=chromium,firefox RUNS=3`, `main` and this change back to back on the same machine (Linux, headless). Every scroll scenario passes the gate in both, with p50 16.7 ms and p95 16.7–17.2 ms either way; load, sort and table heap are within noise (1M rows in Chromium: load 717 → 674 ms, heap 301 → 297 MB). `main`'s run had one wheel failure at 1M rows in Chromium (two frames over 50 ms), this one none: noise, not a gain. The last row is reached at 1M rows in both engines.

## Consequences

- `argus-table` depends on `lit` and `@tanstack/table-core` only. The README's "built with Lit and TanStack" still holds.
- Scrolling behaviour is now all in `VirtualController` and core (`RowSizes`, `ScrollScale`, `RowPool`, `steadyWindow`); fixes no longer depend on a TanStack Virtual release, and none come from one either.
