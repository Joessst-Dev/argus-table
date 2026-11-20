import 'argus-table';
import { byRegion, byRegionAndStatus, saleColumns, sales } from '../../data.ts';

/** @typedef {import('../../data.ts').Sale} Sale */
const table = /** @type {import('argus-table').ArgusTable<Sale>} */ (
  document.querySelector('#row-grouping-sales-table')
);
const byStatus = /** @type {HTMLInputElement} */ (
  document.querySelector('#row-grouping-sales-status')
);

table.columns = saleColumns;
table.data = sales;
table.getRowId = (sale) => sale.id;
// One group row per region, with its count and the sum of its amounts.
table.grouping = byRegion;
byStatus.addEventListener('change', () => {
  table.grouping = byStatus.checked ? byRegionAndStatus : byRegion;
});
