import { useRef, useState } from 'react';
import {
  ArgusTable,
  type ArgusTableElement,
  type ColumnDef,
  type ScrollAlign,
} from '@argus-table/react';
import { aligns, months, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160 },
  ...months,
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', pin: 'end' },
];

// Rows by id need getRowId; defined once, as a new function would reset the table's rows.
const rowIdOf = (order: Order) => order.id;

export default function ScrollTo() {
  const table = useRef<ArgusTableElement<Order>>(null);
  const [rowId, setRowId] = useState('o50000');
  const [column, setColumn] = useState('m15');
  const [align, setAlign] = useState<ScrollAlign>('center');
  const [result, setResult] = useState('');
  // Both methods resolve true once the target is in view, false when there's none.
  const show = (found: boolean) => {
    setResult(found ? 'Scrolled.' : 'Not found.');
  };
  return (
    <>
      <p className="example-controls">
        <label>
          Order id{' '}
          <input
            value={rowId}
            size={8}
            onChange={(e) => {
              setRowId(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setResult('Scrolling…');
            void table.current?.scrollToRow({ id: rowId }, { align }).then(show);
          }}
        >
          Scroll to row
        </button>
        <label>
          Column{' '}
          <select
            value={column}
            onChange={(e) => {
              setColumn(e.target.value);
            }}
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {typeof c.header === 'string' ? c.header : c.id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setResult('Scrolling…');
            void table.current?.scrollToColumn(column, { align }).then(show);
          }}
        >
          Scroll to column
        </button>
        <label>
          Align{' '}
          <select
            value={align}
            onChange={(e) => {
              setAlign(e.target.value as ScrollAlign);
            }}
          >
            {aligns.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <output aria-live="polite">{result}</output>
      </p>
      <ArgusTable
        ref={table}
        aria-label="Orders"
        style={{ blockSize: 340 }}
        columns={columns}
        data={orders}
        getRowId={rowIdOf}
      />
    </>
  );
}
