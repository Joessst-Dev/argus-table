import { ArgusTable, type ColumnDef } from '@argus-table/react';
import { formatSize } from '../../data';
import { createDriveSource, type DriveItem } from '../../server';

const columns: ColumnDef<DriveItem>[] = [
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
// The server's ids, unique across levels: expanded rows follow them through a sort.
const itemId = (item: DriveItem) => item.id;
// Created once: a new source starts again, without the folders' entries it loaded.
const source = createDriveSource();

export default function LazyTree() {
  // getRows pages the top-level entries; hasChildren and getChildren make them a
  // tree, a folder's entries loading when it's expanded.
  return (
    <ArgusTable
      aria-label="Shared drive"
      style={{ blockSize: 380 }}
      columns={columns}
      getRowId={itemId}
      dataSource={source}
    />
  );
}
