# ADR 0011: Displayed rows: positions inside, data indexes outside

- **Status:** Accepted (17 November 2026).
- **Builds on:** [ADR 0010](0010-own-row-model.md) (core's own row model) and [ADR 0001](0001-shadow-vs-light-dom.md) (pooled rows, slotted content). Design: `docs/superpowers/specs/2026-11-17-detail-rows-design.md`.

## Context

Detail panels (`rowDetail`) put a row under a data row that isn't a data row. Tree data and row grouping, next on the roadmap, need the same: rows the body shows that aren't rows of `data`.

Until now a body row's position was its data index. Everything counted on it: `aria-rowindex`, keyboard moves, the virtualizer's count, the row pool, Shift-range selection, and every public index: `scrollToRow(index)`, `argus-cell-click` / `argus-row-click`'s `index`, `argus-range-change`, `RowDetailContext.index`, the plugin host. The public ones are frozen (ADR 0004).

A panel's content is interactive (forms, nested tables), so it has to be a row of the grid of its own: Down arrow lands on it, Enter goes into it. Putting it inside its row's box would make a row with one cell more than there are columns.

## Decision

- **Core has displayed rows** (`table/display-rows.ts`, `model.display`): data rows in the current order, and a panel row after each expanded row that can show one (loaded, allowed by `rowExpandable`). It maps both ways in O(log k) for k open panels, and is the identity without panels. The model rebuilds it when the row order, `expanded`, `rowExpandable` or `detail` change.
- **Inside the element, the body works in positions.** `layoutOf()`'s body count, `aria-rowindex`, the virtualizer, the row pools, the navigation controller's active cell and `RowMeasure` count positions. **Every public surface converts at its edge** to data indexes (`dataIndexOf`, `positionOfIndex`, `display.dataRange` in `grid.ts` and core): events, `scrollToRow`, `getState().scroll`, `argus-range-change`, data source requests, selection, plugins' targets and `focusCell`.
- **Two row pools.** Data rows and panel rows each have one, and a pooled row never switches between the two: that would remove a row's `c-{slot}-{col}` slots and add a panel slot, which changes slot assignment and cancels WebKit's wheel scrolling. With panels, each pool renders every slot it has made, the unused ones hidden (`idle`, `display: none`), so none is removed while scrolling.
- **Panel content is kept per row id** (`render/detail-content.ts`): one Lit root per open panel, in a holder moved into the slot element of the pool slot its row has now. Out of the window the holder stays detached and connected, so typed input and framework component state survive; it's released when the panel closes, its row can't show one, `rowDetail` goes away or the table disconnects.
- **Panels are measured in both row-height modes** (`MeasuredRows.all` is `false` with fixed heights: only panels). Opening or closing a panel above the view keeps the top row in place (`VirtualConfig.keepTop`), without writing the scroll position while the user scrolls.
- **This table's own elements only.** Keys, focus and clicks are matched to this table's shadow root (`gridCell(target, root)`, rows whose root node is this one's), so a table nested in a cell or a panel keeps its own.

## Options not taken

- **The panel inside its row's box.** No mapping, but the panel would be an extra cell in its row, Down arrow would skip it, screen readers would read the form as part of the row, and tree data and grouping would get nothing.
- **Panels in the data pool.** One pool is simpler, but a slot switching between a data row and a panel changes slot assignment while scrolling (WebKit).
- **A plugin hook for rows.** Plugins can't add rows; letting them would be this mechanism plus a public API to freeze.

## Consequences

- Code that reads a body `GridRow`'s `index` must ask whether it means a position or a data index. `model.rowAt()`, `valueAt()`, `cellContext()` and `indexOf()` take and return data indexes; `layoutOf()` and `VirtualController` work in positions.
- Tree data and grouping add kinds of displayed rows (`DisplayRow.kind`) and keep the same split.
- Evidence: unit tests in all three engines (`detail-rows.test.ts`: positions, pools and slot stability, measuring, keyboard, nested tables, content kept, RTL), e2e (`tests/e2e/specs/detail-rows.spec.ts`, 1M rows with panels open), the docs site's e2e per flavour, and the benchmark's `detail=100` variant (in the PR).
