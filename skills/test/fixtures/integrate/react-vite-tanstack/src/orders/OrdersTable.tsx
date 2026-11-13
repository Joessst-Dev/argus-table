import { useRef } from 'react';
import { createColumnHelper, getCoreRowModel, getExpandedRowModel, getGroupedRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Order {
  id: number;
  customer: string;
  region: string;
  total: number;
}

const columnHelper = createColumnHelper<Order>();

const columns = [
  columnHelper.accessor('customer', { header: 'Customer', enableColumnFilter: true }),
  columnHelper.accessor('region', { header: 'Region' }),
  columnHelper.accessor('total', { header: 'Total', aggregationFn: 'sum' }),
];

export function OrdersTable({ orders }: { orders: Order[] }) {
  const parent = useRef<HTMLDivElement>(null);
  const table = useReactTable({
    data: orders,
    columns,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 34 });
  return <div ref={parent}>{virtualizer.getVirtualItems().length}</div>;
}
