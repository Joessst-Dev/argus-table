import { useState } from 'react';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];

export default function QuickFilter() {
  const [search, setSearch] = useState('');
  return (
    <>
      <p>
        <label>
          Search orders{' '}
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </label>
      </p>
      {/* Rows that contain every word in one of their shown columns, ignoring case. */}
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 340 }}
        columns={columns}
        data={orders}
        quickFilter={search}
      />
    </>
  );
}
