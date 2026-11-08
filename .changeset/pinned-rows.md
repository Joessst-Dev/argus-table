---
'argus-table': minor
---

Pinned rows: `pinnedRows: { top?, bottom? }` keeps rows fixed below the header or at the bottom of the view while the body scrolls, for a totals or summary row. They are separate objects, not rows of `data`: the columns read them as usual, they are never sorted, and they work the same with a `dataSource`.

- A column's `cell` function gets `pinned: 'top' | 'bottom'` in its context, so it can show a summary row its own way.
- The keyboard moves through them like any row: from the header into the top rows, the body, and on to the bottom rows; Ctrl+End lands on the last one. PageUp and PageDown page through the body only.
- Clicks and Enter on them fire `argus-cell-click` and `argus-row-click`, with `pinned` in the detail and `index` counted within their list.
- New parts `row-pinned`, `row-pinned-top`, `row-pinned-bottom` and `cell-pinned-row`, and a new token `--argus-pinned-row-bg` for their background.
- Screen readers count them as rows: the first body row's `aria-rowindex` now comes after the top pinned rows.
