# @argus-table/vue

Vue components for [`<argus-table>`](https://www.npmjs.com/package/argus-table): `<ArgusTable>` and `<ArgusColumn>`, with typed props, typed events and `v-model`. The row type is inferred from `data`.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i @argus-table/vue @argus-table/themes
```

`argus-table` comes with it. Vue 3.5 or newer is a peer dependency. No `isCustomElement` setting is needed: you use the components, not the raw tags.

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

- **Props** set the element's properties: `columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `rowHeight`, `density`, `overscan`, `virtualizeColumns`, `sorting`, `columnSizing`, `columnOrder`, `selectionMode`, `selectionCheckboxes` and `selection`. Other attributes (`aria-label`, `class`, `style`, …) go to the element.
- **Events** get the element's `CustomEvent`: `sort-change`, `column-resize`, `column-reorder`, `cell-click`, `row-click`, `range-change`, `load-error` and `row-select`. In `@row-click`, `e.detail.row` has your row type. The details are in the [`argus-table` README](https://www.npmjs.com/package/argus-table).
- **Cells:** a column's `cell` function returns a string, a number, a DOM node or a Lit template. Vue content in cells is planned.
- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.

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

With `selection-mode="multi"`, `v-model:selection` holds the selected row ids. Leave one unbound and the table keeps that state itself. A one-way `:sorting` is controlled: a header click only emits `update:sorting` and `sort-change` with the proposed order, and nothing changes until you set it.

## Methods

A template ref gives `refresh()`, `scrollToRow(index)`, `autosizeColumns(ids?)` and the `element` itself:

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
