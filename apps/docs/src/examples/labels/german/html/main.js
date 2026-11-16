import 'argus-table';
import { cellEditing } from '@argus-table/editing';
import { tableExport } from '@argus-table/export';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import {
  editingLabels,
  exportLabels,
  formulaLabels,
  menuLabels,
  orders,
  tableLabels,
} from '../../data.ts';

/** @typedef {import('../../data.ts').Order} Order */
const table = /** @type {import('argus-table').ArgusTable<Order>} */ (
  document.querySelector('#labels-german-table')
);

/** @type {import('argus-table').ColumnDef<Order>[]} */
const columns = [
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
/** @type {import('argus-table').ArgusPlugin<Order>[]} */
const plugins = [
  tableExport({ labels: exportLabels }),
  formulas({ editing: 'edit', labels: formulaLabels }),
  headerMenu({ labels: menuLabels }),
  cellEditing({ labels: editingLabels }),
];

table.columns = columns;
table.data = orders;
table.labels = tableLabels;
table.plugins = plugins;
