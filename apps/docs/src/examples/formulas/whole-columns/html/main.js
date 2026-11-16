import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { dataColumns, items } from '../../data.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#formulas-whole-columns-table')
);

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  // Product gets a filter kind: Filter… in its menu.
  { ...dataColumns[0], filter: 'set' },
  ...dataColumns.slice(1, 4),
  {
    id: 'total',
    header: 'Total',
    formula: '[Unit price] * [Quantity] * (1 - [Discount])',
    width: 100,
    sortable: true,
  },
  // [[name]] is a whole column: every row the filters keep.
  {
    id: 'share',
    header: 'Share %',
    formula: 'ROUND([Total] / SUM([[Total]]) * 100, 3)',
    width: 100,
    sortable: true,
  },
  {
    id: 'orders',
    header: 'Orders of product',
    formula: 'COUNTIF([[Product]], [Product])',
    width: 150,
  },
  { id: 'rank', header: 'Rank', formula: 'RANK([Total], [[Total]])', width: 80, sortable: true },
  {
    id: 'best',
    header: 'Best seller',
    formula: 'INDEX([[Product]], MATCH(MAX([[Total]]), [[Total]], 0))',
    width: 130,
  },
];

/** @type {import('argus-table').ArgusPlugin<Item>[]} */
const plugins = [formulas(), headerMenu()];

table.columns = columns;
table.data = items;
table.plugins = plugins;
table.sorting = [{ id: 'rank', desc: false }];
