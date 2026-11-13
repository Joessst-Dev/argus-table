---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

New event `argus-column-resize-end`: it fires once when a user's resize is done, so you can save column widths without saving on every frame of a drag.

```js
table.addEventListener('argus-column-resize-end', (event) => {
  localStorage.setItem('widths', JSON.stringify(event.detail.columnSizing));
});
```

- It fires when a drag on a column's or group's resize handle is released, after each Alt+Arrow press, and after a double-click on a handle or `autosizeColumns()` fits columns to their content. It comes after that resize's `argus-column-sizing-change` events.
- `detail: { columnSizing, columnIds }`: the sizing after the resize and the columns it changed. When `columnSizing` is controlled, it's the last proposed sizing.
- It doesn't fire when nothing changed (a column already at its `minWidth`, a press without moving), or when `columnSizing` or `setState()` set the widths.
- The wrappers have it as `onColumnResizeEnd` (React), `@column-resize-end` (Vue) and `(columnResizeEnd)` (Angular), and export the `ColumnResizeEndDetail` type.
