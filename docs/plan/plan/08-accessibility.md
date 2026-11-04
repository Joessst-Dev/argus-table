# Accessibility and keyboard

[← Back to contents](../README.md)

The table follows the WAI-ARIA grid pattern from the first release; retrofitting it later would mean rewriting focus handling.

- Roles: `grid`, `rowgroup`, `row`, `columnheader`, `gridcell`; `aria-rowcount` / `aria-colcount` for the full size and `aria-rowindex` / `aria-colindex` on rendered rows and cells, so virtualization stays invisible to screen readers.
- Sorting announced via `aria-sort` on the sorted header only (none on the others, as the APG recommends). Sortable headers sort with Enter or Space when focused.
- One tab stop into the grid, then roving focus: arrows move by cell (Left/Right mirrored in RTL) and between the header row and the body, Home/End by row; Ctrl+Home/End to corners and PageUp/PageDown by viewport come in Phase 2. The tab stop starts on the first header. Keys pressed inside cell content (an input, a button) are left to that content.
- Focus survives virtualization: the focused cell is tracked by row id + column id and kept rendered, holding its row-pool slot so its DOM is never recycled.
- Body rows are pooled and stay in pool order, so DOM order can differ from visual order. Keeping the DOM sorted cost too much (the ADR 0001 [addendum](../../adr/0001-shadow-vs-light-dom.md#addendum-sorted-dom-phase-1)), so row positions come from `aria-rowindex` alone, and keyboard navigation moves by row index, never by DOM sibling. A screen-reader check (VoiceOver with Safari, NVDA with Firefox) before v0.1 confirms this is enough.
- Resize handles reachable by keyboard (focus header, then Alt+Arrow to resize), with `aria-valuenow`.
- Visible focus ring via `--argus-focus-ring`; every theme must pass WCAG AA contrast.
- `prefers-reduced-motion` turns off smooth scrolling and transitions.
- Automated axe checks in CI, plus a manual screen-reader pass (NVDA, VoiceOver) before each minor release.
