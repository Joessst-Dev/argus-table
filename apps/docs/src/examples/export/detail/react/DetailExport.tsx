import { useRef } from 'react';
import { downloadTable, tableExport, type ExportDetail } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ArgusTableElement, type ReactColumnDef } from '@argus-table/react';
import { linesOf, orders, type Line, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

// Every exported order's lines: under it in Excel and PDF, one CSV line each.
const detail: ExportDetail<Order, Line> = {
  columns: [
    { id: 'product', header: 'Product', width: 160 },
    { id: 'quantity', header: 'Qty', align: 'end', width: 60 },
    { id: 'price', header: 'Price', align: 'end', width: 80 },
  ],
  rows: (order) => linesOf(order),
};
// The column menu offers Export and Export with details.
const plugins = [tableExport<Order>({ filename: 'orders', detail }), headerMenu<Order>()];
const idOf = (order: Order) => order.id;

export default function DetailExport() {
  const table = useRef<ArgusTableElement<Order>>(null);
  const download = (format: 'csv' | 'xlsx') => {
    if (table.current) void downloadTable(table.current, format);
  };
  return (
    <>
      <p>
        <button
          type="button"
          onClick={() => {
            download('csv');
          }}
        >
          CSV with lines
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            download('xlsx');
          }}
        >
          Excel with lines
        </button>
      </p>
      <ArgusTable
        ref={table}
        aria-label="Orders"
        style={{ blockSize: 340 }}
        columns={columns}
        data={orders}
        getRowId={idOf}
        rowDetail={({ row }) => (
          <ul>
            {linesOf(row).map((line, i) => (
              <li key={i}>
                {line.quantity} × {line.product}
              </li>
            ))}
          </ul>
        )}
        plugins={plugins}
      />
    </>
  );
}
