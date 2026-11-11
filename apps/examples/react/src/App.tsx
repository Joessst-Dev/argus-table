import { useState } from 'react';
import { ArgusTable, type ReactColumnDef, type SelectionState } from '@argus-table/react';
import { headerMenu } from '@argus-table/header-menu';
import { createOrders, currency, type Order, type Status } from './data';

const orders = createOrders();

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{status}</span>;
}

// Columns and plugins hold functions, so define them once (outside the component or in useMemo).
// `filter` lets users filter a column from its menu: text, number, date or a set of values.
// A cell can return JSX: it renders through a portal, so it sees your context providers.
const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start', cell: (o) => `#${o.id}` },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 130,
    align: 'end',
    sortable: true,
    filter: 'number',
    cell: (o) => currency.format(o.total),
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 130,
    sortable: true,
    filter: 'set',
    cell: (o) => <StatusBadge status={o.status} />,
  },
];

// The column menu: sort, filter, pin and hide from the button in each header.
const plugins = [headerMenu<Order>()];

const getRowId = (order: Order) => order.id;

export function App() {
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<SelectionState>([]);

  return (
    <>
      <h1>Orders</h1>
      <input
        type="search"
        placeholder="Search orders"
        aria-label="Search orders"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {/* A click selects a row; Ctrl/Cmd+click adds one, Shift+click a range. */}
      <ArgusTable
        aria-label="Orders"
        columns={columns}
        data={orders}
        getRowId={getRowId}
        plugins={plugins}
        quickFilter={search}
        selectionMode="multi"
        selectionCheckboxes
        selection={selection}
        onRowSelect={(e) => setSelection(e.detail.selection)}
      />
      <p role="status">
        {selection.length === 0
          ? 'Click a row or its checkbox to select it.'
          : `${String(selection.length)} ${selection.length === 1 ? 'order' : 'orders'} selected`}
      </p>
    </>
  );
}
