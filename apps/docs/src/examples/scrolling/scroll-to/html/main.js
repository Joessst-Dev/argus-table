import 'argus-table';
import { months, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
/** @param {string} id */
const $ = (id) => document.querySelector(`#scrolling-scroll-to-${id}`);
const table = /** @type {import('argus-table').ArgusTable<Order>} */ ($('table'));
const row = /** @type {HTMLInputElement} */ ($('row'));
const column = /** @type {HTMLSelectElement} */ ($('column'));
const align = /** @type {HTMLSelectElement} */ ($('align'));
const output = /** @type {HTMLOutputElement} */ ($('output'));

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
  { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 160 },
  ...months,
  { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', pin: 'end' },
];
table.columns = columns;
table.data = orders;
// Rows by id need getRowId.
table.getRowId = (/** @type {Order} */ order) => order.id;

for (const c of columns)
  column.add(
    new Option(typeof c.header === 'string' ? c.header : c.id, c.id, false, c.id === 'm15'),
  );

/** Both methods resolve true once the target is in view, false when there's none. */
/** @param {boolean} found */
const show = (found) => {
  output.textContent = found ? 'Scrolled.' : 'Not found.';
};
const options = () => ({
  align: /** @type {import('argus-table').ScrollAlign} */ (align.value),
});
/** @type {HTMLButtonElement} */ ($('row-button')).addEventListener('click', () => {
  void table.scrollToRow({ id: row.value }, options()).then(show);
});
/** @type {HTMLButtonElement} */ ($('column-button')).addEventListener('click', () => {
  void table.scrollToColumn(column.value, options()).then(show);
});
