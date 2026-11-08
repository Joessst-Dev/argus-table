import type { ColumnDef } from '../index.js';

export interface Order {
  id: string;
  customer: string;
  total: number;
}

export const orders: Order[] = Array.from({ length: 50 }, (_, i) => ({
  id: `o${String(i)}`,
  customer: `Customer ${String(i)}`,
  total: (i * 37) % 100,
}));

export const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 200 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, sortable: true },
];

/** The size `fixture()` uses: virtualization renders nothing in a 0×0 box. */
export const size = { inlineSize: '600px', blockSize: '400px' };
