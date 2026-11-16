import 'argus-table';
import { barHeight, orders, totals } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#row-height-auto-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
  { id: 'city', header: 'City', accessor: 'city', width: 110 },
  { id: 'status', header: 'Status', accessor: 'status', width: 100 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
  { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
  {
    id: 'bar',
    header: 'Bar',
    width: 70,
    // Content taller than a line: the row grows to fit it.
    cell: (order) => {
      const bar = document.createElement('div');
      bar.style.inlineSize = '12px';
      bar.style.blockSize = `${String(barHeight(order))}px`;
      bar.style.background = 'currentColor';
      bar.style.opacity = '0.4';
      return bar;
    },
  },
];

table.columns = columns;
table.data = orders;
table.pinnedRows = { bottom: [totals] };
