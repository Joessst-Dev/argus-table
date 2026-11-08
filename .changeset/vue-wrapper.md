---
'@argus-table/vue': minor
---

New package: `@argus-table/vue`, Vue components for `<argus-table>` and `<argus-column>`.

```vue
<ArgusTable
  v-model:sorting="sorting"
  aria-label="Orders"
  :columns="columns"
  :data="orders"
  @row-click="(e) => open(e.detail.row)"
/>
```

- Props set the element's properties. Each event is emitted without its `argus-` prefix (`sort-change`, `column-resize`, `column-reorder`, `cell-click`, `row-click`, `range-change`, `load-error`) with the element's `CustomEvent`, its detail typed.
- `v-model:sorting`, `v-model:column-sizing` and `v-model:column-order`. Unbound, the table keeps that state itself; a one-way binding is controlled.
- The row type is inferred from `data`, so vue-tsc checks `e.detail.row` in your templates. In render functions, give it: `h(ArgusTable<Order>, …)`.
- A template ref gives `refresh()`, `scrollToRow()`, `autosizeColumns()` and the `element`.
- `<ArgusColumn>` writes columns as children, so they can come from a `v-for`. Boolean attributes work as in HTML: `<ArgusColumn sortable>`.
- Vue 3.5 or newer.
