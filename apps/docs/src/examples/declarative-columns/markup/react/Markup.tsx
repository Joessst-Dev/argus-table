import { ArgusColumn, ArgusTable } from '@argus-table/react';
import { orders, type Order } from '../../data';

export default function Markup() {
  return (
    <ArgusTable aria-label="Orders" style={{ blockSize: 320 }} data={orders} getRowId={(o) => o.id}>
      <ArgusColumn columnId="id" header="Order" accessor="id" width={90} pin="start" />
      <ArgusColumn
        columnId="customer"
        header="Customer"
        accessor="customer"
        width={{ flex: 1 }}
        minWidth={160}
        sortable
      />
      <ArgusColumn columnId="city" header="City" accessor="city" width={120} />
      <ArgusColumn<Order>
        columnId="status"
        header="Status"
        width={110}
        cell={(order) => <strong>{order.status}</strong>}
      />
      <ArgusColumn
        columnId="total"
        header="Total"
        accessor="total"
        width={100}
        align="end"
        sortable
      />
      <ArgusColumn
        columnId="actions"
        header="Actions"
        width={100}
        pin="end"
        resizable={false}
        cell={() => <button type="button">Open</button>}
      />
    </ArgusTable>
  );
}
