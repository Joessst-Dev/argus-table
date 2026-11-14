---
'argus-table': minor
'@argus-table/react': minor
'@argus-table/vue': minor
'@argus-table/angular': minor
---

Headers that are templates, JSX or VNodes can now give their column a plain-text name, and columns get a `meta` field for plugins' and your own settings.

```js
const columns = [
  {
    id: 'total',
    // `text` is true when the table or a plugin asks for the name as plain text.
    header: ({ text }) => (text ? 'Total' : html`<b>Total</b> <small>EUR</small>`),
    accessor: 'total',
    meta: { export: { header: 'Total (EUR)' } },
  },
];
```

- A `header` function gets a context: `{ columnId, text }` for a column, `{ groupId, text }` for a column group (types `HeaderContext` and `GroupHeaderContext`). The table renders it with `text: false`. With `text: true` it returns the name as plain text, which the column menu, exports and the table's announcements use. A header with no text is named by its column id, as before. Headers that ignore the context keep working.
- When a column moves from the keyboard (Alt+Shift+Arrow), the announcement names it by that text first, then by the header's visible text.
- `meta` holds fields for plugins and the app. The table doesn't read it; plugins get it as `host.column(id).meta`. Type your own fields by augmenting `ColumnMeta`: `declare module 'argus-table' { interface ColumnMeta<TData> { … } }`. With only a framework wrapper installed, augment `'@argus-table/react'`, `'@argus-table/vue'` or `'@argus-table/angular'` instead. `<argus-column>` takes `meta` as a property.
- For plugins: `host.headerText(def)` returns a column's or group's name (`undefined` when its header has none), and `ColumnInfo.meta` is the column's `meta`. A plugin that wraps headers in its own function should forward text mode: `(context) => (context.text ? host.headerText(def) : …)`.
- The wrappers type `header` with the context, and export `ColumnMeta`, `HeaderContext` and `GroupHeaderContext`. A Vue `#header-<id>` or `#group-<id>` slot, or an Angular `argusHeader` or `argusGroupHeader` template, names its column or group by the `header` in its definition.
- If your own code calls a column's `header()` directly, it now has to pass a context, for example `{ columnId: def.id, text: false }`.
