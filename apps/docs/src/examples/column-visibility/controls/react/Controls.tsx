import { useState } from 'react';
import {
  ArgusTable,
  type ColumnDef,
  type ColumnPinningState,
  type ColumnVisibilityState,
} from '@argus-table/react';
import { pinOf, tasks, type PinChoice, type Task } from '../../data';

const columns: ColumnDef<Task>[] = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start', hideable: false },
  { id: 'title', header: 'Title', accessor: 'title', width: 180 },
  { id: 'owner', header: 'Owner', accessor: 'owner', width: 110 },
  { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, hidden: true },
];

export default function Controls() {
  // Records by column id, over the columns' own `hidden` and `pin`.
  const [visibility, setVisibility] = useState<ColumnVisibilityState>({});
  const [pinning, setPinning] = useState<ColumnPinningState>({});
  return (
    <>
      <form className="column-controls">
        {columns.map((column) => {
          const pin = pinning[column.id];
          return (
            <fieldset key={column.id}>
              <legend>{typeof column.header === 'string' ? column.header : column.id}</legend>
              <label>
                <input
                  type="checkbox"
                  checked={visibility[column.id] ?? !column.hidden}
                  disabled={column.hideable === false}
                  onChange={(e) => {
                    setVisibility({ ...visibility, [column.id]: e.target.checked });
                  }}
                />{' '}
                Shown
              </label>
              <label>
                Pin{' '}
                <select
                  value={pin === undefined ? (column.pin ?? 'none') : pin || 'none'}
                  onChange={(e) => {
                    setPinning({ ...pinning, [column.id]: pinOf(e.target.value as PinChoice) });
                  }}
                >
                  <option>none</option>
                  <option>start</option>
                  <option>end</option>
                </select>
              </label>
            </fieldset>
          );
        })}
      </form>
      <ArgusTable
        aria-label="Tasks"
        style={{ blockSize: 320 }}
        columns={columns}
        data={tasks}
        columnVisibility={visibility}
        columnPinning={pinning}
      />
    </>
  );
}
