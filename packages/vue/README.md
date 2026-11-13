# @argus-table/vue

Vue components for [`<argus-table>`](https://www.npmjs.com/package/argus-table): `<ArgusTable>` and `<ArgusColumn>`, with typed props, typed events and `v-model`. The row type is inferred from `data`.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i @argus-table/vue @argus-table/themes
```

`argus-table` comes with it. Vue 3.5 or newer is a peer dependency. No `isCustomElement` setting is needed: you use the components, not the raw tags.

With a coding agent, the [`argus-table-integrate` skill](https://github.com/Joessst-Dev/argus-table/tree/main/skills#readme) sets the table up in your app, or migrates one from AG Grid, TanStack Table, MUI X and others.

## A first table

```vue
<script setup lang="ts">
import { ArgusTable, type ColumnDef } from '@argus-table/vue';
import '@argus-table/themes/default.css';

interface Order {
  id: string;
  customer: string;
  total: number;
}

defineProps<{ orders: Order[] }>();

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
</script>

<template>
  <ArgusTable
    aria-label="Orders"
    style="height: 400px"
    :columns="columns"
    :data="orders"
    :get-row-id="(order) => order.id"
    @row-click="(e) => console.log(e.detail.row)"
  />
</template>
```

- **Props** set the element's properties: `columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `rowHeight`, `density`, `overscan`, `virtualizeColumns`, `sorting`, `columnSizing`, `columnOrder`, `selectionMode`, `selectionCheckboxes`, `selection` and `plugins`. Other attributes (`aria-label`, `class`, `style`, …) go to the element.
- **Events** get the element's `CustomEvent`: `sorting-change`, `column-sizing-change`, `column-order-change`, `column-pinning-change`, `column-visibility-change`, `column-filters-change`, `selection-change`, `cell-click`, `row-click`, `range-change` and `load-error`. Each `…-change` event also emits `update:<property>` with the new value, for `v-model`. In `@row-click`, `e.detail.row` has your row type. The details are in the [`argus-table` README](https://www.npmjs.com/package/argus-table).
- **Cells and headers** can be Vue content: `#cell-<column id>` and `#header-<column id>` slots, or `cell`/`header` functions that return VNodes. See [Vue content in cells](#vue-content-in-cells).
- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.

## Vue content in cells

Give a column its cells or header with a slot named after its id:

```vue
<ArgusTable :columns="columns" :data="orders">
  <template #cell-status="{ row, value }">
    <StatusBadge :status="value" :order="row.id" />
  </template>
  <template #header-total="{ columnId }">Total <InfoTip :topic="columnId" /></template>
</ArgusTable>
```

- `#cell-<id>` gets the row and its context: `{ row, value, rowId, index, columnId, pinned? }`, typed with your row type. `#header-<id>` gets `{ columnId }`.
- Slots work for `:columns` arrays and `<ArgusColumn>` children alike. A column without a slot keeps its own `cell` and `header`. A slot that goes away (`v-if`) hands the column back.
- In `columns`, `cell` and `header` can also return VNodes: `cell: (o) => h(StatusBadge, { status: o.status })` (`VueColumnDef<T>` types it).
- Cells see your app (global components, directives, `app.provide`: router, Pinia, i18n) and what `<ArgusTable>`'s ancestors `provide()`. A slot follows the state it reads, and updates by itself when that changes.
- Cells are pooled: as the table scrolls, a cell shows another row and its components **update with new props instead of remounting**. Keep per-row state in your data (or keyed by `rowId`), not in a cell component's own state.
- Slotted content renders before the browser paints and before `width: 'auto'` measures. The slots run as the table's first plugin, so `headerMenu()` and `formulas()` wrap slotted headers as usual.

## v-model

`sorting`, `columnSizing`, `columnOrder` and `selection` bind two-way:

```vue
<script setup lang="ts">
const sorting = ref<SortState>([]);
</script>

<template>
  <ArgusTable v-model:sorting="sorting" :columns="columns" :data="orders" />
</template>
```

With `selection-mode="multi"`, `v-model:selection` holds the selected row ids. Leave one unbound and the table keeps that state itself. A one-way `:sorting` is controlled: a header click only emits `update:sorting` and `sorting-change` with the proposed order, and nothing changes until you set it. To save column widths once a resize is done, rather than on every frame of a drag, use `@column-resize-end` (`e.detail.columnSizing`).

## Formula columns

With `formulas()` from [`@argus-table/formulas`](https://www.npmjs.com/package/@argus-table/formulas) in `plugins`, the formula editor proposes column changes through `@formula-column-add`, `@formula-column-change` and `@formula-column-remove`. The table doesn't change its columns: apply `e.detail.columns`, which holds your columns, slots included.

```vue
<script setup lang="ts">
const columns = shallowRef<readonly VueColumnDef<Order>[]>(initialColumns);
const apply = (e: CustomEvent<FormulaColumnDetail<Order>>) => (columns.value = e.detail.columns);
</script>

<template>
  <ArgusTable
    :columns="columns"
    :data="orders"
    :plugins="plugins"
    @formula-column-add="apply"
    @formula-column-change="apply"
    @formula-column-remove="apply"
  />
</template>
```

## Methods

A template ref gives `refresh()`, `scrollToRow(index)`, `autosizeColumns(ids?)`, `getState()` / `setState(state)` (save and restore a user's layout: sorting, widths, order, pinning, hidden columns, filters, selection and scroll position) and the `element` itself:

```vue
<script setup lang="ts">
const table = useTemplateRef('table');
const top = () => table.value?.scrollToRow(0);
</script>

<template>
  <ArgusTable ref="table" :columns="columns" :data="orders" />
</template>
```

## Columns as children

`<ArgusColumn>` renders an `<argus-column>`, so columns can come from a `v-for`. Changing, adding, removing or moving one keeps the widths, the order and the sort:

```vue
<ArgusTable :data="orders">
  <ArgusColumn column-id="id" header="Order" accessor="id" :width="90" pin="start" />
  <ArgusColumn v-for="c in extra" :key="c.id" :column-id="c.id" :header="c.label" :accessor="c.id" sortable />
</ArgusTable>
```

A non-empty `columns` prop wins over the children.

## Render functions

`h()` can't infer the row type, so give it: `h(ArgusTable<Order>, { columns, data, onRowClick })`.

## License

MIT
