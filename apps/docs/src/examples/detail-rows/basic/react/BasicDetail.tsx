import { useState } from 'react';
import { ArgusTable, type RowDetailContext } from '@argus-table/react';
import { columns, idOf, orders, type Order } from '../../data';

// Defined once: a new function each render would render every panel again.
const summary = ({ row }: RowDetailContext<Order>) => (
  <p className="order-summary">
    {row.customer} in {row.city}, {row.status}: {row.total}
  </p>
);

export default function BasicDetail() {
  const [expanded, setExpanded] = useState<readonly string[]>(['o2']);
  // A chevron column appears; a row's panel shows what rowDetail returns for it.
  return (
    <ArgusTable
      aria-label="Orders"
      style={{ blockSize: 380 }}
      columns={columns}
      data={orders}
      getRowId={idOf}
      rowDetail={summary}
      expanded={expanded}
      onExpandedChange={(event) => {
        setExpanded(event.detail.expanded);
      }}
    />
  );
}
