import { useState } from 'react';
import { ArgusTable, type ColumnDef, type SelectionState } from '@argus-table/react';
import { describeSelection, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
// Selection is by row id.
const rowId = (order: Order) => order.id;

export default function MultiSelection() {
  const [selection, setSelection] = useState<SelectionState>([]);
  return (
    <>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 320 }}
        selectionMode="multi"
        columns={columns}
        data={orders}
        getRowId={rowId}
        selection={selection}
        onSelectionChange={(e) => {
          setSelection(e.detail.selection);
        }}
      />
      <p>
        <output>{describeSelection(selection)}</output>
      </p>
    </>
  );
}
