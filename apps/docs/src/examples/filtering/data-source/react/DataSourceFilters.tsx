import { useState } from 'react';
import { ArgusTable, type ColumnDef, type ColumnFilterState } from '@argus-table/react';
import { createSource, describe, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, filter: 'text' },
  // The table can't see every value of a remote column: list the set filter's options.
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    filter: 'set',
    filterOptions: ['open', 'paid', 'shipped'],
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];
const filters: ColumnFilterState = { status: { kind: 'set', values: ['shipped'] } };

export default function DataSourceFilters() {
  const [last, setLast] = useState('');
  // Created once: a new source starts again from an empty cache.
  const [source] = useState(() =>
    createSource((request) => {
      setLast(describe(request));
    }),
  );
  return (
    <>
      {/* The table doesn't filter a data source's rows: it sends the filters to getRows. */}
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 300 }}
        columns={columns}
        dataSource={source}
        columnFilters={filters}
        quickFilter="customer 9"
      />
      <p>
        Last request: <output>{last}</output>
      </p>
    </>
  );
}
