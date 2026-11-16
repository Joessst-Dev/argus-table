import 'argus-table';
import { items, months, shadows } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#pinned-columns-basic-table')
);
const rtl = /** @type {HTMLInputElement} */ (document.querySelector('#pinned-columns-basic-rtl'));
const shadow = /** @type {HTMLSelectElement} */ (
  document.querySelector('#pinned-columns-basic-shadow')
);

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
  { id: 'name', header: 'Name', accessor: 'name', width: 140, pin: 'start' },
  ...months,
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

// 'start' follows the writing direction: the right side in RTL.
rtl.addEventListener('change', () => {
  table.dir = rtl.checked ? 'rtl' : 'ltr';
});
shadow.addEventListener('change', () => {
  table.style.setProperty(
    '--argus-pinned-shadow',
    shadows[/** @type {keyof typeof shadows} */ (shadow.value)] || null,
  );
});
