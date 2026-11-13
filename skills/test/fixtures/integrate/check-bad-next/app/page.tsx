import { ArgusTable, type ColumnDef } from '@argus-table/react';
import type { Invoice } from './columns';

const columns: ColumnDef<Invoice>[] = [
  { id: 'id', header: 'Invoice', accessor: 'id', sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', cell: (i) => `€${String(i.total)}` },
];

export default async function Page() {
  const invoices: Invoice[] = await (await fetch('https://api.example.com/invoices')).json();
  return (
    <ArgusTable
      aria-label="Invoices"
      columns={columns}
      data={invoices}
      getRowId={(i) => i.id}
      onRowClick={(e) => console.log(e.detail.row)}
    />
  );
}
