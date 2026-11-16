import { useState } from 'react';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { average, money, orders, totals, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
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

export default function TopAndBottom() {
  const [top, setTop] = useState(true);
  const [bottom, setBottom] = useState(true);
  const [log, setLog] = useState('Click a row.');
  return (
    <>
      <p>
        <label>
          <input
            type="checkbox"
            checked={top}
            onChange={(e) => {
              setTop(e.target.checked);
            }}
          />{' '}
          Average row on top
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={bottom}
            onChange={(e) => {
              setBottom(e.target.checked);
            }}
          />{' '}
          Totals row at the bottom
        </label>
      </p>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 340 }}
        columns={columns}
        data={orders}
        getRowId={(order) => order.id}
        pinnedRows={{ top: top ? [average] : [], bottom: bottom ? [totals] : [] }}
        // A click or Enter on a pinned row says which side it's on.
        onRowClick={(e) => {
          const { rowId, pinned } = e.detail;
          setLog(`argus-row-click: ${rowId}${pinned ? ` (pinned: ${pinned})` : ''}`);
        }}
      />
      <p>
        <output aria-live="polite">{log}</output>
      </p>
    </>
  );
}
