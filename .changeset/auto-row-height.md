---
'argus-table': minor
---

`rowHeight: 'auto'` (`row-height="auto"`) fits each row to its content: wrapped text in `wrap` columns, and content taller than a line.

```html
<argus-table row-height="auto"></argus-table>
```

- The row height from `density` or `--argus-row-height` is the least a row is, and the header's height: the header doesn't grow. Pinned rows grow like body rows.
- Content sits at the top of the cell, with the padding that centres one line, so one-line rows look as before. The new `--argus-cell-padding-block` token sets that padding.
- Rows are measured as they render (framework content included), and again when their content changes size, such as an image loading: give images a size, so rows don't move then. Rows not seen yet count as one row.
- Rows above the view that get taller don't move the rows you're looking at, and don't cut a scroll short.
- Heights follow rows through sorting and filtering. Keyboard navigation, `scrollToRow()`, `getState()`/`setState()` and a million rows work as with fixed heights.
- With `virtualizeColumns`, a row's height counts the columns rendered: a tall cell scrolling in from the side makes its row taller then.
