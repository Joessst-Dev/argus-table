import 'argus-table';
import { products } from '../../data.ts';

/** @typedef {import('../../data.ts').Product} Product */
const table = /** @type {import('argus-table').ArgusTable<Product>} */ (
  document.querySelector('#auto-width-fit-to-content-table')
);
const fit = /** @type {HTMLButtonElement} */ (
  document.querySelector('#auto-width-fit-to-content-fit')
);
const output = /** @type {HTMLOutputElement} */ (
  document.querySelector('#auto-width-fit-to-content-output')
);

/** @type {import('argus-table').ColumnDef<Product>[]} */
const columns = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 80, pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 80 },
  { id: 'category', header: 'Category', accessor: 'category', width: 80 },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];

table.columns = columns;
table.data = products;

// A fit is a resize: it fires argus-column-sizing-change for each column it changes.
let resizes = 0;
table.addEventListener('argus-column-sizing-change', () => {
  output.textContent = String(++resizes);
});
fit.addEventListener('click', () => {
  void table.autosizeColumns();
});
