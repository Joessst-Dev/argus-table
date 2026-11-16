import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { barHeight, orders, totals, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'city', header: 'City', accessor: 'city', width: 110 },
  { id: 'status', header: 'Status', accessor: 'status', width: 100 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
  { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
  {
    id: 'bar',
    header: 'Bar',
    width: 70,
    // Content taller than a line: the row grows to fit it.
    cell: (order) => <div className="bar" style={{ blockSize: barHeight(order) }} />,
  },
];

export default function AutoRows() {
  return (
    <ArgusTable
      aria-label="Orders with notes, rows fit their content"
      style={{ blockSize: 400 }}
      rowHeight="auto"
      columns={columns}
      data={orders}
      pinnedRows={{ bottom: [totals] }}
    />
  );
}
