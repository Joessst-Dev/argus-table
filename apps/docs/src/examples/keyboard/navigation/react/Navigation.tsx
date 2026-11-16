import { useState } from 'react';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { describeClick, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

export default function Navigation() {
  const [log, setLog] = useState('Click a cell.');
  return (
    <>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 320 }}
        columns={columns}
        data={orders}
        // A click, or Enter on a focused cell.
        onCellClick={(e) => {
          setLog(describeClick(e.detail));
        }}
      />
      <p>
        <output aria-live="polite">{log}</output>
      </p>
    </>
  );
}
