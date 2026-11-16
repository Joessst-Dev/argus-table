import { useRef, useState } from 'react';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ArgusTableElement, type ColumnDef } from '@argus-table/react';
import { load, orders, store, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
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
const rowId = (order: Order) => order.id;
// The column menu (sort, filter, pin, hide), created once.
const plugins = [headerMenu<Order>()];
const STORAGE_KEY = 'argus-docs:saved-state:react';

export default function SaveRestore() {
  const table = useRef<ArgusTableElement<Order>>(null);
  const [status, setStatus] = useState('');
  return (
    <>
      <p className="example-controls">
        <button
          type="button"
          onClick={() => {
            store(STORAGE_KEY, table.current?.getState());
            setStatus('Saved.');
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            const saved = load(STORAGE_KEY);
            if (!saved) {
              setStatus('Nothing saved yet.');
              return;
            }
            void table.current?.setState(saved).then(() => {
              setStatus('Restored.');
            });
          }}
        >
          Restore
        </button>
        <button
          type="button"
          onClick={() => {
            store(STORAGE_KEY, undefined);
            setStatus('Forgotten.');
          }}
        >
          Forget
        </button>
        <output aria-live="polite">{status}</output>
      </p>
      <ArgusTable
        ref={table}
        aria-label="Orders"
        style={{ blockSize: 320 }}
        selectionMode="multi"
        columns={columns}
        data={orders}
        getRowId={rowId}
        plugins={plugins}
      />
    </>
  );
}
