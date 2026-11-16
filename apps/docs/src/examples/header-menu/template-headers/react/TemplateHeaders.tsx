import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  {
    id: 'customer',
    // Asked for text (the menu's "Show Customer", announcements), it gives a name.
    header: ({ text }) =>
      text ? (
        'Customer'
      ) : (
        <span>
          Customer <small>(name)</small>
        </span>
      ),
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
const plugins = [headerMenu<Order>()];

export default function TemplateHeaders() {
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ blockSize: 320 }}
      columns={columns}
      data={orders}
      plugins={plugins}
    />
  );
}
