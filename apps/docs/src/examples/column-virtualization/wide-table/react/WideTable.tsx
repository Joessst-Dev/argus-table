import { ArgusTable, type ReactColumnDef } from '@argus-table/react';
import { items, valueColumns, type Item } from '../../data';

const columns: ReactColumnDef<Item>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
  ...valueColumns,
  {
    id: 'actions',
    header: 'Actions',
    width: 90,
    pin: 'end',
    cell: () => <button type="button">Open</button>,
  },
];

export default function WideTable() {
  return (
    <ArgusTable
      aria-label="Wide table"
      style={{ blockSize: 340 }}
      virtualizeColumns
      columns={columns}
      data={items}
    />
  );
}
