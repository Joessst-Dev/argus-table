---
'argus-table': minor
---

Column virtualization for wide tables. Add `virtualize-columns` (the `virtualizeColumns` property) and the table renders only the scrolling columns in view, plus two on each side, instead of every column in every row:

```html
<argus-table virtualize-columns></argus-table>
```

- Pinned columns, the checkbox column and the focused cell's column always render. Focus survives scrolling sideways, and the arrow keys, Home and End reach every column.
- `width: 'auto'` columns out of view still fit their content, and `autosizeColumns()` still measures columns out of view.
- Column reordering by drag works across columns that aren't rendered yet: the table scrolls, and the columns render as they come into view.
- Off by default. With it on, cells are reused as columns scroll in and out, so their order in the DOM no longer follows the columns: page CSS that relies on it (`:nth-child` on cells) doesn't apply. `aria-colindex` gives each cell's position.
