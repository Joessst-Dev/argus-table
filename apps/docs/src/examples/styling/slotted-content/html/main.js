import 'argus-table';
import '../../styles.css';
import { orderColumns, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#styling-slotted-content-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  ...orderColumns.filter((column) => column.id !== 'status'),
  {
    id: 'status',
    header: 'Status',
    width: 120,
    // Content in the light DOM: the page's .badge classes apply.
    cell: (order) => {
      const badge = document.createElement('span');
      badge.className = `badge badge-${order.status}`;
      badge.textContent = order.status;
      return badge;
    },
  },
  {
    id: 'actions',
    // A label for screen readers only; in text mode, the column's name.
    header: ({ text }) => {
      if (text) return 'Actions';
      const label = document.createElement('span');
      label.className = 'visually-hidden';
      label.textContent = 'Actions';
      return label;
    },
    width: 90,
    pin: 'end',
    cell: (order) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Open';
      button.ariaLabel = `Open ${order.id}`;
      return button;
    },
  },
];

table.columns = columns;
table.data = orders;
