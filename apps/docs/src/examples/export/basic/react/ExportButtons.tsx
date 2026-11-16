import { useRef, useState } from 'react';
import { downloadTable, tableExport } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import {
  ArgusTable,
  type ArgusTableElement,
  type ColumnDef,
  type ColumnGroup,
} from '@argus-table/react';
import { formats, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
  { id: 'city', header: 'City', accessor: 'city', width: 120, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 110 },
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
const groups: ColumnGroup[] = [{ id: 'where', header: 'Delivery', columns: ['city', 'status'] }];
const rowId = (order: Order) => order.id;
// With headerMenu(), every column menu offers the formats too.
const plugins = [tableExport<Order>({ filename: 'orders', title: 'Orders' }), headerMenu<Order>()];

export default function ExportButtons() {
  const table = useRef<ArgusTableElement<Order>>(null);
  const [search, setSearch] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  return (
    <>
      <div role="toolbar" aria-label="Export" className="example-controls">
        <label>
          Search{' '}
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={selectedOnly}
            onChange={(e) => {
              setSelectedOnly(e.target.checked);
            }}
          />{' '}
          Selected rows only
        </label>
        {formats.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            onClick={() => {
              // What the table shows: its columns in order, its rows sorted and filtered.
              if (table.current) {
                void downloadTable(table.current, format, {
                  rows: selectedOnly ? 'selected' : 'view',
                });
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <ArgusTable
        ref={table}
        aria-label="Orders"
        style={{ blockSize: 320 }}
        selectionMode="multi"
        selectionCheckboxes
        columns={columns}
        columnGroups={groups}
        data={orders}
        getRowId={rowId}
        plugins={plugins}
        quickFilter={search}
      />
    </>
  );
}
