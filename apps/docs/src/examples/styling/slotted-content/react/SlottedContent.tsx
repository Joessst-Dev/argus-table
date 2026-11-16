import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import '../../styles.css';
import { orderColumns, orders, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  ...orderColumns.filter((column) => column.id !== 'status'),
  {
    id: 'status',
    header: 'Status',
    width: 120,
    // JSX in the light DOM: the page's .badge classes apply.
    cell: (order) => <span className={`badge badge-${order.status}`}>{order.status}</span>,
  },
  {
    id: 'actions',
    // A label for screen readers only; in text mode, the column's name.
    header: ({ text }) => (text ? 'Actions' : <span className="visually-hidden">Actions</span>),
    width: 90,
    pin: 'end',
    cell: (order) => (
      <button type="button" aria-label={`Open ${order.id}`}>
        Open
      </button>
    ),
  },
];

export default function SlottedContent() {
  return (
    <ArgusTable
      className="styling-slotted"
      aria-label="Orders"
      style={{ blockSize: 320 }}
      columns={columns}
      data={orders}
    />
  );
}
