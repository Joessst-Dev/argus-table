import { useState } from 'react';
import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { orders, type Order } from '../../data';

// At module scope: stable across renders.
const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer.name',
    width: { flex: 1 },
    sortable: true,
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
const getRowId = (order: Order) => order.id;

export default function FirstTable() {
  const [selected, setSelected] = useState<string>();
  return (
    <>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 320 }}
        columns={columns}
        data={orders}
        getRowId={getRowId}
        onRowClick={(e) => {
          setSelected(e.detail.row.id);
        }}
      />
      <p>
        <output>{selected ? `Selected order ${selected}` : 'Click a row.'}</output>
      </p>
    </>
  );
}
