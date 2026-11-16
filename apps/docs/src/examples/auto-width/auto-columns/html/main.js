import 'argus-table';
import { products } from '../../data.ts';

/** @typedef {import('../../data.ts').Product} Product */
const table = /** @type {import('argus-table').ArgusTable<Product>} */ (
  document.querySelector('#auto-width-auto-columns-table')
);

/** @type {import('argus-table').ColumnDef<Product>[]} */
const columns = [
  { id: 'sku', header: 'SKU', accessor: 'sku', width: 'auto', pin: 'start' },
  { id: 'name', header: 'Product', accessor: 'name', width: 'auto', maxWidth: 360 },
  { id: 'category', header: 'Category', accessor: 'category', width: 'auto' },
  { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
];

table.columns = columns;
table.data = products;
