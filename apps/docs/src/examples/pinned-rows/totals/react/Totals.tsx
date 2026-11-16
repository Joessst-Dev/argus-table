import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { money, orders, totals, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    // The cell sees `pinned`, and shows a summary row its own way.
    cell: (order, { pinned }) => (pinned ? <strong>{order.customer}</strong> : order.customer),
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (order) => money(order.total),
  },
];

export default function Totals() {
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ blockSize: 340 }}
      columns={columns}
      data={orders}
      getRowId={(order) => order.id}
      pinnedRows={{ bottom: [totals] }}
    />
  );
}
