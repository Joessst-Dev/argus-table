import { useState } from 'react';
import { ArgusTable, type ColumnDef, type ColumnFilterState } from '@argus-table/react';
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

export default function ColumnFilters() {
  const [status, setStatus] = useState('open');
  const [total, setTotal] = useState(500);
  // A filter per column id; a column left out isn't filtered.
  const filters: ColumnFilterState = {
    ...(status && { status: { kind: 'set', values: [status] } }),
    ...(!Number.isNaN(total) && { total: { kind: 'number', op: 'ge', value: total } }),
  };
  return (
    <>
      <p className="example-controls">
        <label>
          Status{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
            }}
          >
            <option value="">any</option>
            <option>open</option>
            <option>paid</option>
            <option>shipped</option>
          </select>
        </label>
        <label>
          Total at least{' '}
          <input
            type="number"
            value={Number.isNaN(total) ? '' : total}
            onChange={(e) => {
              setTotal(e.target.valueAsNumber);
            }}
          />
        </label>
      </p>
      <ArgusTable
        aria-label="Orders"
        style={{ blockSize: 340 }}
        columns={columns}
        data={orders}
        columnFilters={filters}
      />
    </>
  );
}
