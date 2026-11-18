import { useRef, useState } from 'react';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import {
  ArgusTable,
  type ArgusTableElement,
  type ColumnDef,
  type ColumnFilterState,
} from '@argus-table/react';
import { dataColumns, type Item } from '../../data';
import { createFormulaSource, describe } from '../../server';

const columns: ColumnDef<Item>[] = [
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
// `server: true`: the server sorts and filters by the formulas' trees.
const plugins = [formulas<Item>({ server: true }), headerMenu<Item>()];
const filters: ColumnFilterState = { total: { kind: 'number', op: 'ge', value: 200 } };
const rowId = (item: Item) => item.id;

export default function FormulaDataSource() {
  const table = useRef<ArgusTableElement<Item>>(null);
  const [last, setLast] = useState('');
  // Created once: getRows sends `formulaTrees(table)` with each request.
  const [source] = useState(() =>
    createFormulaSource(
      () => table.current,
      (request) => {
        setLast(describe(request));
      },
    ),
  );
  return (
    <>
      <ArgusTable
        ref={table}
        aria-label="Order items"
        style={{ blockSize: 320 }}
        columns={columns}
        dataSource={source}
        getRowId={rowId}
        plugins={plugins}
        columnFilters={filters}
      />
      <p>
        Last request: <output>{last}</output>
      </p>
    </>
  );
}
