import { useState } from 'react';
import { ArgusTable, type ReactColumnDef, type SortState } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    cell: (order) => <strong>{order.total.toFixed(2)}</strong>,
  },
];

export default function Sorting() {
  const [sorting, setSorting] = useState<SortState>([{ id: 'total', desc: true }]);
  const [sort] = sorting;
  return (
    <>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 320 }}
        columns={columns}
        data={orders}
        sorting={sorting}
        onSortingChange={(e) => {
          setSorting(e.detail.sorting);
        }}
      />
      <p>
        Sorted by:{' '}
        <output>{sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing'}</output>
      </p>
    </>
  );
}
