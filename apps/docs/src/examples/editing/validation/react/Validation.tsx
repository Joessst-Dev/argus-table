import { useState } from 'react';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { orders, validateTotal, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    filter: 'number',
    meta: {
      edit: {
        // Shipped orders can't change; a message keeps the editor open.
        editable: (order) => order.status !== 'shipped',
        validate: validateTotal,
      },
    },
  },
];
const rowId = (order: Order) => order.id;
const plugins = [cellEditing<Order>()];

export default function Validation() {
  const [data, setData] = useState(orders);
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ blockSize: 320 }}
      columns={columns}
      data={data}
      getRowId={rowId}
      plugins={plugins}
      // The table never changes data: apply each committed edit.
      onCellEdit={(e) => {
        setData((rows) => applyEdit(rows, e.detail, columns));
      }}
    />
  );
}
