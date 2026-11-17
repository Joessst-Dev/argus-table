import 'argus-table';
import { itemColumns, items } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
/** @param {string} id */
const $ = (id) => document.querySelector(`#scrolling-fit-to-content-${id}`);
const table = /** @type {import('argus-table').ArgusTable<Item>} */ ($('table'));

let count = 4;
table.columns = itemColumns;
table.data = items(count);

/** @type {HTMLButtonElement} */ ($('add')).addEventListener('click', () => {
  table.data = items(++count);
});
/** @type {HTMLButtonElement} */ ($('remove')).addEventListener('click', () => {
  count = Math.max(0, count - 1);
  table.data = items(count);
});
