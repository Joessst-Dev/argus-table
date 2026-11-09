import { useState } from 'react';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { createOrders, currency, statusBadge, type Order } from './data';

const orders = createOrders();

// Columns hold functions, so define them once (outside the component or in useMemo).
const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start', cell: (o) => `#${o.id}` },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    sortable: true,
    cell: (o) => currency.format(o.total),
  },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, cell: statusBadge },
];

const getRowId = (order: Order) => order.id;

export function App() {
  const [selected, setSelected] = useState<Order>();

  return (
    <>
      <h1>Orders</h1>
      <ArgusTable
        aria-label="Orders"
        columns={columns}
        data={orders}
        getRowId={getRowId}
        onRowClick={(e) => setSelected(e.detail.row)} // e.detail.row is an Order
      />
      <p role="status">
        {selected ? `Selected order #${selected.id} (${selected.customer})` : 'Click a row.'}
      </p>
    </>
  );
}
