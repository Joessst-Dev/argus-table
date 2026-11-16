import { useRef } from 'react';
import { downloadTable, tableExport } from '@argus-table/export';
import { ArgusTable, type ArgusTableElement, type ReactColumnDef } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  // JSX in the header; in text mode (exports, the menu) it gives a name.
  {
    id: 'customer',
    header: ({ text }) =>
      text ? (
        'Customer'
      ) : (
        <span>
          <b>Customer</b> ✦
        </span>
      ),
    accessor: 'customer',
    width: { flex: 1 },
  },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  // Left out of the files.
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 110,
    meta: { export: { exclude: true } },
  },
  // Shown with cents, exported as whole euros under another header.
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 120,
    align: 'end',
    cell: (order) => `${order.total.toFixed(2)} €`,
    meta: { export: { header: 'Total (EUR)', value: (value) => Math.round(Number(value)) } },
  },
];
const plugins = [tableExport<Order>({ filename: 'orders' })];

export default function ColumnMeta() {
  const table = useRef<ArgusTableElement<Order>>(null);
  return (
    <>
      <p>
        <button
          type="button"
          onClick={() => {
            if (table.current) void downloadTable(table.current, 'csv');
          }}
        >
          Download CSV
        </button>
      </p>
      <ArgusTable
        ref={table}
        aria-label="Orders"
        style={{ blockSize: 300 }}
        columns={columns}
        data={orders}
        plugins={plugins}
      />
    </>
  );
}
