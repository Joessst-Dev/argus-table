---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Scroll to a row by id, choose where it lands, and scroll to a column.

```js
await table.scrollToRow(500, { align: 'center' });
await table.scrollToRow({ id: 'order-42' }, { align: 'nearest' });
await table.scrollToColumn('total');
```

- `scrollToRow()` takes an index in the current row order, as before, or `{ id }` with a `getRowId` id. Its new `align` option puts the row at the top of the view (`'start'`, the default, as before), at the bottom (`'end'`), in the middle (`'center'`), or scrolls only as far as needed to show it (`'nearest'`). The header and pinned rows are left out of the view, so the row never ends up behind them.
- `scrollToColumn(id)` scrolls sideways so the column shows between the pinned columns: by default only as far as needed (`'nearest'`), or with `align: 'start' | 'center' | 'end'`. It works right to left, with flex columns and with `virtualizeColumns`.
- Both resolve `true` once the table has re-rendered with the target in view, and `false` when there's nothing to scroll to: an unknown id, a row that's filtered out or not loaded, a hidden column. `scrollToRow()` used to resolve `undefined`.
- With a `dataSource` that doesn't know its total yet, `scrollToRow()` to an index past the rows counted so far keeps scrolling toward it as pages arrive, as `setState()` does, until the user scrolls, clicks or presses a key.
- New types: `ScrollAlign`, `ScrollToRowOptions`, `ScrollToColumnOptions` and `RowTarget`, also exported by the React, Vue and Angular wrappers. Their components expose `scrollToColumn()` too.
