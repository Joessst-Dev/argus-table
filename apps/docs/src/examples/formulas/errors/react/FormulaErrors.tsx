import type { CSSProperties } from 'react';
import { formulas } from '@argus-table/formulas';
import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { dataColumns, itemsOf, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
  ...dataColumns,
  { id: 'per', header: 'Per piece', formula: '[Unit price] / [Quantity]', width: 110 },
  {
    id: 'safe',
    header: 'Per piece (safe)',
    formula: 'IFERROR(ROUND([Unit price] / [Quantity], 2), "–")',
    width: 150,
  },
  { id: 'missing', header: 'Weight × 2', formula: '[Weight] * 2', width: 110 },
  { id: 'loop', header: 'Loop', formula: '[Loop] + 1', width: 90 },
  { id: 'unknown', header: 'Tax', formula: 'TAX([Unit price])', width: 90 },
];
const plugins = [formulas<Item>()];
const data = itemsOf(5);

export default function FormulaErrors() {

  return (
    <ArgusTable
      aria-label="Order items"
      style={{ blockSize: 320, '--argus-formula-error-fg': '#b42318' } as CSSProperties}
      columns={columns}
      data={data}
      plugins={plugins}
    />
  );
}
