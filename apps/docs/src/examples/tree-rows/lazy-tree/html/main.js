import 'argus-table';
import { formatSize } from '../../data.ts';
import { createDriveSource } from '../../server.ts';

/** @typedef {import('../../server.ts').DriveItem} DriveItem */
const table = /** @type {import('argus-table').ArgusTable<DriveItem>} */ (
  document.querySelector('#tree-rows-lazy-tree-table')
);

/** @type {import('argus-table').ColumnDef<DriveItem>[]} */
const columns = [
  { id: 'name', header: 'Name', accessor: 'name', width: { flex: 1 }, sortable: true },
  { id: 'type', header: 'Type', accessor: 'type', width: 130 },
  {
    id: 'size',
    header: 'Size',
    accessor: 'size',
    width: 110,
    align: 'end',
    sortable: true,
    cell: (item) => formatSize(item.size),
  },
];

table.columns = columns;
// The server's ids, unique across levels: expanded rows follow them through a sort.
table.getRowId = (/** @type {DriveItem} */ item) => item.id;
// getRows pages the top-level entries; hasChildren and getChildren make them a tree,
// a folder's entries loading when it's expanded.
table.dataSource = createDriveSource();
