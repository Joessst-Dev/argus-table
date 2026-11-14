---
'@argus-table/export': minor
---

A column can carry its own export options as `meta.export`, next to its definition, instead of in the `columns` option keyed by id:

```js
{ id: 'total', header: 'Total', accessor: 'total', meta: { export: { header: 'Total (EUR)', value: (v) => Math.round(v) } } },
{ id: 'actions', cell: () => html`…`, meta: { export: { exclude: true } } },
```

- `meta.export` takes the same `header`, `value` and `exclude` as the `columns` option, typed for your rows. The `columns` option of `tableExport()` and of each call still applies and wins field by field.
- Columns and groups whose header is a template, JSX or a slot are now named in the header row by their header's text mode (`header: ({ text }) => (text ? 'Total' : …)`), else by their id.
- `tableExport()` no longer has to come first in `plugins`: it reads the names when it exports, and the other add-ons pass them through.
