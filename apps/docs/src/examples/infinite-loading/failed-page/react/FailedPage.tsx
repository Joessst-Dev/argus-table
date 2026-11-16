import { useState } from 'react';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { createSource, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];
// Created once: a new source starts again from an empty cache.
const source = createSource({ failOnce: true });

export default function FailedPage() {
  const [log, setLog] = useState('');
  return (
    <>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 340 }}
        columns={columns}
        dataSource={source}
        // A failed page fires argus-load-error, and its rows show a Retry button.
        onLoadError={(e) => {
          const { error, start, end } = e.detail;
          setLog(`argus-load-error: rows ${String(start)}–${String(end)}, ${String(error)}`);
        }}
      />
      <p>
        <output role="status">{log}</output>
      </p>
    </>
  );
}
