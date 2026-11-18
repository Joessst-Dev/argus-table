import { useMemo, useState } from 'react';
import { ArgusTable } from '@argus-table/react';
import { itemColumns, items } from '../../data';

export default function FitToContent() {
  const [count, setCount] = useState(4);
  const data = useMemo(() => items(count), [count]);
  return (
    <>
      <p className="example-controls">
        <button
          type="button"
          onClick={() => {
            setCount(count + 1);
          }}
        >
          Add row
        </button>
        <button
          type="button"
          onClick={() => {
            setCount(Math.max(0, count - 1));
          }}
        >
          Remove row
        </button>
      </p>
      {/* As tall as its rows, up to 320px; past that it scrolls. */}
      <ArgusTable
        aria-label="Line items"
        style={{ blockSize: 'auto', maxBlockSize: 320 }}
        columns={itemColumns}
        data={data}
      />
    </>
  );
}
