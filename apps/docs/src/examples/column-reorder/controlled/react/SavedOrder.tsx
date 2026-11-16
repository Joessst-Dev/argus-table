import { useEffect, useState } from 'react';
import { ArgusTable, type ColumnDef, type ColumnOrderState } from '@argus-table/react';
import { tasks, type Task } from '../../data';

// Each flavour on the page saves its own.
const STORAGE_KEY = 'argus-docs:task-order:react';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
  { id: 'status', header: 'Status', accessor: 'status', width: 130 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

function savedOrder(): ColumnOrderState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ColumnOrderState;
  } catch {
    return [];
  }
}

export default function SavedOrder() {
  const [order, setOrder] = useState<ColumnOrderState>([]);
  // localStorage exists only in the browser: read it after the first render.
  useEffect(() => {
    setOrder(savedOrder());
  }, []);
  return (
    <>
      <ArgusTable
        aria-label="Tasks"
        style={{ blockSize: 320 }}
        columns={columns}
        data={tasks}
        columnOrder={order}
        onColumnOrderChange={(e) => {
          setOrder(e.detail.columnOrder);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(e.detail.columnOrder));
        }}
      />
      <p>
        Saved order: <output>{JSON.stringify(order)}</output>
      </p>
    </>
  );
}
