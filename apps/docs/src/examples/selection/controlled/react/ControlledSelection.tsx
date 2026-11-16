import { useState } from 'react';
import { ArgusTable, type ColumnDef, type SelectionState } from '@argus-table/react';
import { describeSelection, MAX_SELECTED, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'city', header: 'City', accessor: 'city', width: 140 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
const rowId = (order: Order) => order.id;

export default function ControlledSelection() {
  const [selection, setSelection] = useState<SelectionState>([]);
  const [refused, setRefused] = useState('');
  return (
    <>
      <p>
        <button
          type="button"
          onClick={() => {
            setSelection([]);
            setRefused('');
          }}
        >
          Clear
        </button>{' '}
        <output>
          {refused}
          {describeSelection(selection)}
        </output>
      </p>
      {/* Controlled: the table only proposes; this code decides. */}
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 320 }}
        selectionMode="multi"
        columns={columns}
        data={orders}
        getRowId={rowId}
        selection={selection}
        onSelectionChange={(e) => {
          const proposed = e.detail.selection;
          if (proposed.length > MAX_SELECTED) {
            setRefused(
              `Refused ${String(proposed.length)} rows: at most ${String(MAX_SELECTED)}. `,
            );
            return;
          }
          setSelection(proposed);
          setRefused('');
        }}
      />
    </>
  );
}
