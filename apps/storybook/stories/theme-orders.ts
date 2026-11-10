// The orders table the theme stories share: a pinned id and total, sortable
// columns, a status chip (styled by each story's page CSS) and a totals row.
import { html } from 'lit';
import type { ColumnDef } from 'argus-table';

export interface Order {
  id: string;
  customer: string;
  city: string;
  status: 'open' | 'paid' | 'shipped';
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'] as const;
export const orders: Order[] = Array.from({ length: 1_000 }, (_, i) => ({
  id: `o${String(i + 1)}`,
  customer: `Customer ${String(i + 1)}`,
  city: cities[i % cities.length] ?? '',
  status: statuses[i % statuses.length] ?? 'open',
  total: Math.round(((i * 7919) % 100_000) / 10) / 10,
}));

const money = (value: number) => value.toLocaleString('en', { minimumFractionDigits: 2 });

export const totals: Order = {
  id: 'total',
  customer: 'Total',
  city: '',
  status: 'open',
  total: Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100,
};

export const orderColumns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    // Page CSS (in each story), not the theme: cell content is in the light DOM.
    cell: (order, { pinned }) =>
      pinned ? '' : html`<span class="chip chip-${order.status}">${order.status}</span>`,
  },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 130,
    align: 'end',
    sortable: true,
    pin: 'end',
    cell: (order) => money(order.total),
  },
];

export const getOrderId = (order: Order): string => order.id;
