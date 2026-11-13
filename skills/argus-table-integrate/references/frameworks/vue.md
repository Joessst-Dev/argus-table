# Vue: `@argus-table/vue`

Vue 3.5 or later. Install `@argus-table/vue` and `argus-table` (and `@argus-table/themes`) at one version. No `isCustomElement` setting is needed.

## Full example

```vue file=src/Orders.vue
<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue';
import { ArgusTable, type ColumnDef, type SelectionState, type SortState } from '@argus-table/vue';
import { headerMenu } from '@argus-table/header-menu';

interface Order {
  id: string;
  customer: string;
  total: number;
  status: 'paid' | 'pending' | 'refunded';
}

const props = defineProps<{ orders: Order[] }>();
const emit = defineEmits<{ open: [order: Order] }>();

const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

// Declared once in <script setup>, never inline in the template.
const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 110, pin: 'start', sortable: true },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (order) => money.format(order.total),
  },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, sortable: true, filter: 'set' },
];
const plugins = [headerMenu<Order>()];
const getRowId = (order: Order) => order.id;

const table = useTemplateRef('table');
const search = ref('');
const sorting = shallowRef<SortState>([{ id: 'id', desc: true }]);
const selection = shallowRef<SelectionState>([]);
const selectedCount = computed(() => selection.value.length);
const total = computed(() => props.orders.length);
</script>

<template>
  <input v-model="search" type="search" aria-label="Search orders" />
  <ArgusTable
    ref="table"
    v-model:sorting="sorting"
    v-model:selection="selection"
    aria-label="Orders"
    style="height: 480px"
    :columns="columns"
    :data="props.orders"
    :get-row-id="getRowId"
    :plugins="plugins"
    :quick-filter="search"
    selection-mode="multi"
    selection-checkboxes
    @row-click="(e) => emit('open', e.detail.row)"
  >
    <template #cell-status="{ row }">
      <span :class="`badge badge-${row.status}`">{{ row.status }}</span>
    </template>
  </ArgusTable>
  <p>
    {{ selectedCount }} of {{ total }} selected
    <button @click="table?.scrollToRow(0)">Back to top</button>
  </p>
</template>
```

## Props and events

- Props are the element's properties, bound with `:` (`:columns`, `:data`, `:get-row-id`); kebab or camel case both work. Simple values can be plain attributes (`selection-mode="multi"`, `density="compact"`). Never `columns="…"` without the colon.
- Events: `@sorting-change`, `@selection-change`, `@row-click`, `@cell-click`, `@column-resize-end`, … with the element's `CustomEvent` (`e.detail`).
- Two-way state: `v-model:sorting`, `v-model:selection`, `v-model:column-sizing` (or `columnSizing`), `v-model:column-order`, `v-model:column-pinning`, `v-model:column-visibility`, `v-model:column-filters`. A one-way `:sorting` is controlled: it only changes when you set it.
- Hold large row arrays in `shallowRef` (or `markRaw`): the table reads rows, Vue doesn't need to make them deeply reactive. Replace the array to change rows.

## Content in cells

- A slot per column id: `#cell-<id>="{ row, value, rowId, index }"`, `#header-<id>="{ columnId }"`, `#group-<groupId>` for a column group's header. Slots see the component's state, the app's global components and `provide`s.
- Or a `cell` that returns VNodes: `cell: (o) => h(StatusBadge, { status: o.status })` (type columns as `VueColumnDef<T>`).
- Cells are pooled: a cell's components get new props as the table scrolls. Keep per-row state in the data.

## Template refs and methods

`useTemplateRef('table')` gives `refresh()`, `scrollToRow()`, `scrollToColumn()`, `autosizeColumns()`, `getState()`, `setState()` and `element` (for `downloadTable(table.value.element, 'csv')`).

## Columns as children

```vue
<ArgusTable aria-label="Orders" :data="orders">
  <ArgusColumn column-id="id" header="Order" accessor="id" :width="110" sortable />
  <ArgusColumn column-id="total" header="Total" accessor="total" align="end" />
</ArgusTable>
```

## Nuxt

Custom elements register in the browser: wrap the table in `<ClientOnly>` (with a fallback of the table's height), and add the theme to `nuxt.config`: `css: ['@argus-table/themes/default.css']`.
