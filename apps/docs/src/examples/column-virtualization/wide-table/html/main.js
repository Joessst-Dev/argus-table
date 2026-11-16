import 'argus-table';
import { items, valueColumns } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#column-virtualization-wide-table-table')
);

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
  ...valueColumns,
  {
    id: 'actions',
    header: 'Actions',
    width: 90,
    pin: 'end',
    cell: () => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Open';
      return button;
    },
  },
];

table.columns = columns;
table.data = items;
