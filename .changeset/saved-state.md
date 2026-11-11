---
'argus-table': minor
---

`getState()` and `setState()` save and restore a user's layout. `getState()` returns the sort order, column widths, column order, pins, hidden columns, filters, selection, `quickFilter` and the scroll position as one object of plain JSON (the new `TableState` type), and `setState(state)` puts it back:

```js
const KEY = 'orders-table';
await table.setState(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
addEventListener('pagehide', () => {
  localStorage.setItem(KEY, JSON.stringify(table.getState()));
});
```

- `setState()` changes only the keys it's given, and ignores ids of columns that no longer exist. It fires no events, like setting a property.
- Properties you control are left alone: set them yourself. The others stay uncontrolled, so users go on changing them as before.
- `scroll` (`{ row, left }`: the row at the top and the horizontal offset, positive in RTL too) is applied after the rest. With a `dataSource`, a row beyond the rows counted so far is scrolled to as its pages arrive, unless the user scrolls, clicks or presses a key first.
- `getState()` returns a copy, with controlled properties at the values you set.
- The bundle with everything inlined grows by about 0.5 kB (gzip).
