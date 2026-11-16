import { useEffect, useState } from 'react';
import { ArgusTable, type ColumnDef, type ColumnSizingState } from '@argus-table/react';
import { tasks, type Task } from '../../data';

// Each flavour on the page saves its own.
const STORAGE_KEY = 'argus-docs:task-widths:react';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
];

function savedWidths(): ColumnSizingState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ColumnSizingState;
  } catch {
    return {};
  }
}

export default function SavedWidths() {
  const [sizing, setSizing] = useState<ColumnSizingState>({});
  // localStorage exists only in the browser: read it after the first render.
  useEffect(() => {
    setSizing(savedWidths());
  }, []);
  return (
    <>
      <ArgusTable
        aria-label="Tasks"
        style={{ blockSize: 320 }}
        columns={columns}
        data={tasks}
        columnSizing={sizing}
        onColumnSizingChange={(e) => {
          setSizing(e.detail.columnSizing);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(e.detail.columnSizing));
        }}
      />
      <p>
        Saved widths: <output>{JSON.stringify(sizing)}</output>
      </p>
    </>
  );
}
