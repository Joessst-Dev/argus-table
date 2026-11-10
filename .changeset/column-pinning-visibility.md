---
'argus-table': minor
---

Columns can be pinned, unpinned, hidden and shown at runtime. Two new properties do it by column id, over each column's own settings, and save as JSON:

```js
table.columnPinning = { total: 'end', id: false }; // pin total to the end, unpin id
table.columnVisibility = { email: false }; // hide email
```

- A column definition (or `<argus-column>`) can start hidden with `hidden`, and `pinnable: false` or `hideable: false` keep users from pinning or hiding it.
- A hidden column isn't rendered, but the table still sorts by it and it keeps its place in the column order. Keyboard moves (Alt+Shift+Arrow) step over it, and focus on a column being hidden moves to the next one.
- A pinned column joins its side nearest its place in the order, and a `{ flex }` column takes a fixed width while it's pinned.
- Like `columnOrder`, both are uncontrolled until you set them. Plugins pin and hide columns with the new `host.setPin()` and `host.setHidden()`, which fire `argus-column-pin` (`{ columnId, pin, pinning }`) and `argus-column-hide` (`{ columnId, hidden, visibility }`, also when a column is shown). When the property is controlled, the event carries the proposed state and nothing changes until you set it. `host.column()` now describes hidden columns too, and `host.columns()` lists every column in order.
