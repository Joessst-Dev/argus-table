import { useState } from 'react';
import { ArgusTable, type RowDetailContext } from '@argus-table/react';
import { columns, idOf, lineColumns, linesOf, orders, type Order } from '../../data';

function Lines({ order }: { order: Order }) {
  // As tall as its rows, up to 240px; past that it scrolls.
  return (
    <ArgusTable
      aria-label={`Lines of ${order.id}`}
      style={{ blockSize: 'auto', maxBlockSize: 240 }}
      columns={lineColumns}
      data={linesOf(order)}
    />
  );
}

const lines = ({ row }: RowDetailContext<Order>) => <Lines order={row} />;

export default function NestedTable() {
  const [expanded, setExpanded] = useState<readonly string[]>(['o1', 'o3']);
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ blockSize: 440 }}
      columns={columns}
      data={orders}
      getRowId={idOf}
      rowDetail={lines}
      expanded={expanded}
      onExpandedChange={(event) => {
        setExpanded(event.detail.expanded);
      }}
    />
  );
}
