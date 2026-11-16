import { useState } from 'react';
import {
  ArgusTable,
  type ColumnDef,
  type ColumnGroup,
  type ColumnSizingState,
} from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const groups: ColumnGroup[] = [
  // reorderable: false keeps the group in place; its columns still move within it.
  { id: 'who', header: 'Who', columns: ['customer', 'city'], reorderable: false },
  { id: 'state', header: 'Order state', columns: ['status', 'total'] },
];

export default function ResizeGroups() {
  const [sizing, setSizing] = useState<ColumnSizingState>({});
  return (
    <>
      <ArgusTable
        aria-label="Resize groups"
        style={{ blockSize: 300 }}
        columns={columns}
        columnGroups={groups}
        data={orders}
        // A group resize is a resize of its columns: one event per column.
        onColumnSizingChange={(e) => {
          setSizing(e.detail.columnSizing);
        }}
      />
      <p>
        columnSizing: <output>{JSON.stringify(sizing)}</output>
      </p>
    </>
  );
}
