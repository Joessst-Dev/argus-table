# Accessibility and keyboard

[← Back to contents](../README.md)

The table follows the WAI-ARIA grid pattern from the first release; retrofitting it later would mean rewriting focus handling.

- Roles: `grid`, `rowgroup`, `row`, `columnheader`, `gridcell`; `aria-rowcount` / `aria-colcount` for the full size and `aria-rowindex` / `aria-colindex` on rendered rows and cells, so virtualization stays invisible to screen readers.
- Sorting announced via `aria-sort` on headers.
- One tab stop into the grid, then roving focus: arrows move by cell, Home/End by row, Ctrl+Home/End to corners, PageUp/PageDown by viewport.
- Focus survives virtualization: the focused cell is tracked by row id + column id and kept rendered, holding its row-pool slot so its DOM is never recycled.
- Body rows are pooled, so DOM order can differ from visual order. Rows carry `aria-rowindex`; screen-reader tests decide whether that is enough or whether the DOM is kept sorted ([ADR 0001](../../adr/0001-shadow-vs-light-dom.md)).
- Resize handles reachable by keyboard (focus header, then Alt+Arrow to resize), with `aria-valuenow`.
- Visible focus ring via `--argus-focus-ring`; every theme must pass WCAG AA contrast.
- `prefers-reduced-motion` turns off smooth scrolling and transitions.
- Automated axe checks in CI, plus a manual screen-reader pass (NVDA, VoiceOver) before each minor release.
