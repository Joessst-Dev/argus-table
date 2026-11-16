import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { densities, orders, type Order } from '../../data';

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

export default function Densities() {
  return densities.map((density) => (
    <section key={density}>
      <p>{density}</p>
      <ArgusTable
        aria-label={`Orders, ${density}`}
        style={{ blockSize: 160 }}
        density={density}
        columns={columns}
        data={orders}
      />
    </section>
  ));
}
