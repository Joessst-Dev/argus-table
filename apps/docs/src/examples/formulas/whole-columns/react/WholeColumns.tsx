import { useState } from 'react';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type ColumnDef, type SortState } from '@argus-table/react';
import { dataColumns, items, type Item } from '../../data';

const columns: ColumnDef<Item>[] = [
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
const plugins = [formulas<Item>(), headerMenu<Item>()];
const data = items;

export default function WholeColumns() {
  // Starts sorted by rank; the table proposes each change, applied here.
  const [sorting, setSorting] = useState<SortState>([{ id: 'rank', desc: false }]);
  return (
    <ArgusTable
      aria-label="Order items"
      style={{ blockSize: 320 }}
      columns={columns}
      data={data}
      plugins={plugins}
      sorting={sorting}
      onSortingChange={(e) => {
        setSorting(e.detail.sorting);
      }}
    />
  );
}
