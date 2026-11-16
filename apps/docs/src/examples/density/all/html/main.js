import 'argus-table';
import { orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
];

for (const density of ['compact', 'comfortable', 'spacious']) {
  const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
    document.querySelector(`#density-all-${density}`)
  );
  table.columns = columns;
  table.data = orders;
}
