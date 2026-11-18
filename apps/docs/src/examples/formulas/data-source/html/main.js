import 'argus-table';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { dataColumns } from '../../data.ts';
import { createFormulaSource, describe } from '../../server.ts';

/** @typedef {import('../../data.ts').Item} Item */
const table = /** @type {import('argus-table').ArgusTable<Item>} */ (
  document.querySelector('#formulas-data-source-table')
);
const log = /** @type {HTMLOutputElement} */ (document.querySelector('#formulas-data-source-log'));

/** @type {import('argus-table').ColumnDef<Item>[]} */
const columns = [
  ...dataColumns,
  {
    id: 'total',
    header: 'Line total',
    formula: 'ROUND([Unit price] * [Quantity] * (1 - [Discount]), 2)',
    width: 120,
    sortable: true,
    filter: 'number',
  },
  {
    id: 'size',
    header: 'Order size',
    formula: 'IF([Quantity] >= 10, "bulk", "single")',
    width: 120,
    sortable: true,
    filter: 'text',
  },
];

// `server: true`: the server below sorts and filters by the formulas' trees.
/** @type {import('argus-table').ArgusPlugin<Item>[]} */
const plugins = [formulas({ server: true }), headerMenu()];
/** @type {import('argus-table').ColumnFilterState} */
const filters = { total: { kind: 'number', op: 'ge', value: 200 } };

table.columns = columns;
table.getRowId = (/** @type {Item} */ item) => item.id;
table.plugins = plugins;
table.columnFilters = filters;
// getRows sends `formulaTrees(table)` with each request.
table.dataSource = createFormulaSource(
  () => table,
  (request) => {
    log.textContent = describe(request);
  },
);
