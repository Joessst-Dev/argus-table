import { useState } from 'react';
import { ArgusTable, type ColumnDef, type SortState } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
];

const describe = (sorting: SortState) => {
  const [sort] = sorting;
  return sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
};

export default function ControlledSorting() {
  const [sorting, setSorting] = useState<SortState>([{ id: 'total', desc: true }]);
  const [message, setMessage] = useState(describe(sorting));
  return (
    <>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 320 }}
        columns={columns}
        data={orders}
        sorting={sorting}
        onSortingChange={(e) => {
          const [sort] = e.detail.sorting;
          // This page refuses one order; every other proposal is applied.
          if (sort?.id === 'customer' && sort.desc) {
            setMessage('Refused: customer descending');
            return;
          }
          setSorting(e.detail.sorting);
          setMessage(describe(e.detail.sorting));
        }}
      />
      <p>
        <output>{message}</output>
      </p>
    </>
  );
}
