import { ArgusTable, type ColumnDef, type ColumnGroup } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  { id: 'ref', header: 'Reference', accessor: (order) => `R-${order.id}`, width: 400 },
];

const groups: ColumnGroup[] = [
  // Order is pinned and Reference scrolls: the group shows on both sides.
  { id: 'ids', header: 'Ids', columns: ['id', 'ref'] },
  { id: 'who', header: 'Who', columns: ['customer', 'city'] },
  { id: 'state', header: 'Order state', columns: ['status', 'total'] },
];

export default function PinnedSplit() {
  return (
    <ArgusTable
      aria-label="Orders with a pinned group"
      style={{ blockSize: 300, inlineSize: 'min(100%, 600px)' }}
      columns={columns}
      columnGroups={groups}
      data={orders}
    />
  );
}
