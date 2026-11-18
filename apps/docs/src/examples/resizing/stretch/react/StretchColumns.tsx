import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { tasks, type Task } from '../../data';

// Fixed widths, narrower than the table: stretchColumns fills the rest.
const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', maxWidth: 70 },
  { id: 'title', header: 'Title', accessor: 'title', width: 200 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

export default function StretchColumns() {
  return (
    <ArgusTable
      aria-label="Tasks"
      style={{ blockSize: 320 }}
      columns={columns}
      data={tasks}
      stretchColumns
    />
  );
}
