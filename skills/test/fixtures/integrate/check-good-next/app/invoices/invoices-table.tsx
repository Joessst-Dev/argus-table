'use client';

import { useState } from 'react';
import { ArgusTable, type ReactColumnDef, type SortState } from '@argus-table/react';

export interface Invoice {
  id: string;
  total: number;
}

const columns: ReactColumnDef<Invoice>[] = [
  { id: 'id', header: 'Invoice', accessor: 'id', sortable: true },
  { id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true, cell: (i) => <b>€{i.total}</b> },
];

const getRowId = (invoice: Invoice) => invoice.id;

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const [sorting, setSorting] = useState<SortState>([]);
  return (
    <ArgusTable
      aria-label="Invoices"
      columns={columns}
      data={invoices}
      getRowId={getRowId}
      selectionMode="multi"
      sorting={sorting}
      onSortingChange={(e) => setSorting(e.detail.sorting)}
    />
  );
}
