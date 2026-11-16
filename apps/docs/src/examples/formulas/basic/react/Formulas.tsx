import { formulas } from '@argus-table/formulas';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { dataColumns, items, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  // Columns by header or id, in brackets; a formula can read another (Gross reads Total).
  {
    id: 'total',
    header: 'Total',
    formula: '[Unit price] * [Quantity] * (1 - [Discount])',
    width: 110,
    sortable: true,
  },
  { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)', width: 110, sortable: true },
  { id: 'stock', header: 'Stock', formula: 'IF([qty] < 10, "Low", "OK")', width: 90 },
  { id: 'month', header: 'Month', formula: 'TEXT([Ordered], "mmm yyyy")', width: 110 },
];
const plugins = [formulas<Item>()];
const data = items;

export default function Formulas() {

  return (
    <ArgusTable
      aria-label="Order items"
      style={{ blockSize: 320 }}
      columns={columns}
      data={data}
      plugins={plugins}
    />
  );
}
