---
'@argus-table/vue': minor
---

Vue content in cells and headers. Give a column its cells or header with a slot named after its id, or return VNodes from `cell` and `header`:

```vue
<ArgusTable :columns="columns" :data="orders">
  <template #cell-status="{ row, value }"><StatusBadge :status="value" /></template>
  <template #header-total>Total <InfoTip /></template>
</ArgusTable>
```

Slots get the row and its context, typed from `data`, and work with `<ArgusColumn>` children too. Cells see your app's and the table's ancestors' injections, and follow the state they read. Cells are pooled: as the table scrolls, a cell's components get the next row's props instead of remounting, so keep per-row state in your data.
