import { useState } from 'react';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  // meta.edit opts a column in; the editor follows its filter kind.
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    meta: { edit: true },
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 130,
    filter: 'set',
    filterOptions: ['open', 'paid', 'shipped'],
    meta: { edit: true },
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
const rowId = (order: Order) => order.id;
const plugins = [cellEditing<Order>()];

export default function Editing() {
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
