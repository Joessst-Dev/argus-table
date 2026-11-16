import { useState } from 'react';
import { applyEdit, cellEditing } from '@argus-table/editing';
import { tableExport } from '@argus-table/export';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTable, type FormulaColumnDetail, type ReactColumnDef } from '@argus-table/react';
import {
  editingLabels,
  exportLabels,
  formulaLabels,
  menuLabels,
  orders,
  tableLabels,
  type Order,
} from '../../data';

const initialColumns: readonly ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Bestellung', accessor: 'id', width: 120, pin: 'start' },
  {
    id: 'customer',
    header: 'Kunde',
    accessor: 'customer',
    width: { flex: 1 },
    sortable: true,
    filter: 'text',
    meta: { edit: true },
  },
  { id: 'city', header: 'Stadt', accessor: 'city', width: 140, filter: 'set' },
  {
    id: 'total',
    header: 'Summe',
    accessor: 'total',
    width: 110,
    align: 'end',
    sortable: true,
    filter: 'number',
  },
  {
    id: 'gross',
    header: 'Brutto',
    formula: 'ROUND([Summe] * 1.19, 2)',
    width: 110,
    sortable: true,
  },
];
// Each add-on takes its own labels; keys left out stay English.
const plugins = [
  tableExport<Order>({ labels: exportLabels }),
  formulas<Order>({ editing: 'edit', labels: formulaLabels }),
  headerMenu<Order>({ labels: menuLabels }),
  cellEditing<Order>({ labels: editingLabels }),
];

export default function German() {
  const [data, setData] = useState(orders);
  const [columns, setColumns] = useState(initialColumns);
  // The add-ons propose; this code applies: edits to data, formula columns to columns.
  const applyColumns = (e: CustomEvent<FormulaColumnDetail<Order>>) => {
    setColumns(e.detail.columns);
  };
  return (
    <ArgusTable
      lang="de"
      aria-label="Bestellungen"
      style={{ blockSize: 320 }}
      selectionMode="multi"
      selectionCheckboxes
      columns={columns}
      data={data}
      labels={tableLabels}
      plugins={plugins}
      onCellEdit={(e) => {
        setData((rows) => applyEdit(rows, e.detail, columns));
      }}
      onFormulaColumnAdd={applyColumns}
      onFormulaColumnChange={applyColumns}
      onFormulaColumnRemove={applyColumns}
    />
  );
}
