import 'argus-table';
import '../../styles.css';
import { orderColumns, orders } from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#styling-parts-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [...orderColumns];

table.columns = columns;
table.data = orders;
