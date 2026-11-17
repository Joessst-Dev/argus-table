import { useState } from 'react';
import { ArgusTable, type RowDetailContext } from '@argus-table/react';
import { columns, idOf, orders, type Order } from '../../data';

function OrderForm({ order }: { order: Order }) {
  // State in the panel survives scrolling: the panel keeps its component.
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState('');
  return (
    <form
      className="order-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(`Saved: ${note}`);
      }}
    >
      <label>
        Note for {order.customer}{' '}
        <input
          name="note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </label>{' '}
      <button type="submit">Save</button> <output>{saved}</output>
    </form>
  );
}

const form = ({ row }: RowDetailContext<Order>) => <OrderForm order={row} />;

export default function FormDetail() {
  const [expanded, setExpanded] = useState<readonly string[]>(['o1']);
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ blockSize: 380 }}
      columns={columns}
      data={orders}
      getRowId={idOf}
      rowDetail={form}
      expanded={expanded}
      onExpandedChange={(event) => {
        setExpanded(event.detail.expanded);
      }}
    />
  );
}
