import 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { load, orders, store } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
/** @param {string} id */
const $ = (id) => document.querySelector(`#saved-state-save-restore-${id}`);
const table = /** @type {import('argus-table').ArgusTable<Order>} */ ($('table'));
const output = /** @type {HTMLOutputElement} */ ($('output'));
const STORAGE_KEY = 'argus-docs:saved-state:html';

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  {
    id: 'customer',
    header: 'Customer',
    accessor: 'customer',
    width: { flex: 1 },
    minWidth: 160,
    sortable: true,
    filter: 'text',
  },
  { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
  { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
  {
    id: 'total',
    header: 'Total',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
];

table.columns = columns;
table.data = orders;
table.getRowId = (/** @type {Order} */ order) => order.id;
// The column menu: sort, filter, pin, hide.
/** @type {import('argus-table').ArgusPlugin<Order>} */
const menu = headerMenu();
table.plugins = [menu];

/** @type {HTMLButtonElement} */ ($('save')).addEventListener('click', () => {
  store(STORAGE_KEY, table.getState());
  output.textContent = 'Saved.';
});
/** @type {HTMLButtonElement} */ ($('restore')).addEventListener('click', () => {
  const saved = load(STORAGE_KEY);
  if (!saved) {
    output.textContent = 'Nothing saved yet.';
    return;
  }
  void table.setState(saved).then(() => {
    output.textContent = 'Restored.';
  });
});
/** @type {HTMLButtonElement} */ ($('forget')).addEventListener('click', () => {
  store(STORAGE_KEY, undefined);
  output.textContent = 'Forgotten.';
});
