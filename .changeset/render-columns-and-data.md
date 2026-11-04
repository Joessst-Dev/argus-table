---
'argus-table': minor
---

Render columns and data. `<argus-table>` now takes `columns`, `data`, `getRowId`, `rowHeight`, `density` and `overscan`, virtualizes rows (100,000 rows keep a small, bounded DOM), slots header and cell content from the light DOM (templates, DOM nodes, strings or numbers), exposes the grid to assistive tech with `aria-rowcount`, `aria-rowindex` and `aria-colindex`, fires `argus-range-change`, and adds `scrollToRow(index)`, the `empty` slot, the structural parts and the first tokens.
