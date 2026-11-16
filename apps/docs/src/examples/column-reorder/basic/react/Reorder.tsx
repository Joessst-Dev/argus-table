import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { tasks, type Task } from '../../data';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

export default function Reorder() {
  return (
    <ArgusTable aria-label="Tasks" style={{ blockSize: 320 }} columns={columns} data={tasks} />
  );
}
