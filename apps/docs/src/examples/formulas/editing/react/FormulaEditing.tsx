import { useState } from 'react';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type FormulaColumnDetail, type ReactColumnDef } from '@argus-table/react';
import { dataColumns, items, type Item } from '../../data';

const initialColumns: readonly ReactColumnDef<Item>[] = [
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
const plugins = [formulas<Item>({ editing: 'edit' }), headerMenu<Item>()];
const data = items;

export default function FormulaEditing() {
  const [columns, setColumns] = useState(initialColumns);
  // The plugin never changes columns itself: it proposes them, and this code applies them.
  const apply = (e: CustomEvent<FormulaColumnDetail<Item>>) => {
    setColumns(e.detail.columns);
  };
  return (
    <ArgusTable
      aria-label="Order items"
      style={{ blockSize: 320 }}
      columns={columns}
      data={data}
      plugins={plugins}
        onFormulaColumnAdd={apply}
        onFormulaColumnChange={apply}
        onFormulaColumnRemove={apply}
    />
  );
}
