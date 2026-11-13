import type { ColumnDef } from '@tanstack/react-table';

export interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
}

export const columns: ColumnDef<Payment>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <input type="checkbox" checked={table.getIsAllPageRowsSelected()} onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)} />
    ),
    cell: ({ row }) => <input type="checkbox" checked={row.getIsSelected()} onChange={(e) => row.toggleSelected(e.target.checked)} />,
    enableSorting: false,
  },
  { accessorKey: 'status', header: 'Status' },
  {
    accessorKey: 'email',
    header: ({ column }) => <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>Email</button>,
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => <div className="text-right">{row.getValue('amount')}</div>,
  },
];
