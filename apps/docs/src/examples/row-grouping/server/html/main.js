import 'argus-table';
import { byRegionAndStatus, saleColumns } from '../../data.ts';
import { createSalesSource } from '../../server.ts';

/** @typedef {import('../../data.ts').Sale} Sale */
const table = /** @type {import('argus-table').ArgusTable<Sale>} */ (
  document.querySelector('#row-grouping-server-table')
);

table.columns = saleColumns;
table.getRowId = (/** @type {Sale} */ sale) => sale.id;
// The server groups: getRows gets grouping and the groupPath of the level it fills.
table.grouping = byRegionAndStatus;
table.dataSource = createSalesSource();
