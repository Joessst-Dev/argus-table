import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { headerMenu } from '@argus-table/header-menu';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'status', header: 'Status', accessor: 'status', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
// Created once: a new plugin would reconnect and close an open menu.
const plugins = [headerMenu<Order>()];

export default function HeaderMenu() {
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
