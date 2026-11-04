import type { ColumnDef } from 'argus-table';

/** Sample rows shared by the docs stories. */
export interface Order {
  id: string;
  customer: string;
  city: string;
  status: 'open' | 'paid' | 'shipped';
  total: number;
}

const cities = ['Lisbon', 'Oslo', 'Quito', 'Hanoi', 'Accra'];
const statuses = ['open', 'paid', 'shipped'] as const;

export function orders(count: number): Order[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `o${String(i + 1)}`,
    customer: `Customer ${String(i + 1)}`,
    city: cities[i % cities.length] ?? '',
    status: statuses[i % statuses.length] ?? 'open',
    total: Math.round(((i * 7919) % 100_000) / 10) / 10,
  }));
}

export const orderColumns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
