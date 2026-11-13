import { useState } from 'react';
import { ArgusTable, type SortState } from '@argus-table/react';
import { headerMenu } from '@argus-table/header-menu';
import { formulas } from '@argus-table/formulas';
import { AgGridReact } from 'ag-grid-react';

interface Order {
  id: string;
  customer: string;
  status: string;
}

export function Orders({ initial }: { initial: Order[] }) {
  const [rows] = useState(initial);
  const [sorting] = useState<SortState>([]);
  const columns = [
    { id: 'customer', field: 'customer', headerName: 'Customer' },
    { id: 'status', header: 'Status', accessor: 'status', filter: 'set' },
  ];

  function add(order: Order) {
    rows.push(order);
  }

  return (
    <>
      <button onClick={() => add({ id: 'x', customer: 'X', status: 'new' })}>Add</button>
      <ArgusTable
        columns={columns}
        data={rows}
        selectionMode="multi"
        sorting={sorting}
        plugins={[headerMenu(), formulas()]}
        rowData={rows}
        onSortChange={() => {}}
      />
      <argus-table aria-label="Legacy" />
      <AgGridReact rowData={rows} />
    </>
  );
}

export function Remote() {
  return (
    <ArgusTable
      aria-label="Remote"
      dataSource={{ getRows: async () => ({ rows: [] }) }}
      columns={[{ id: 'city', header: 'City', accessor: 'city', filter: 'set', sortable: true }]}
    />
  );
}
