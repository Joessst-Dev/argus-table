import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { formatSize } from '../../data';
import { createDriveSource, type DriveItem } from '../../server';

@Component({
  selector: 'app-lazy-tree',
  imports: [ArgusTableComponent],
  template: `
    <!-- getRows pages the top-level entries; hasChildren and getChildren make them a
         tree, a folder's entries loading when it's expanded. -->
    <argus-table
      aria-label="Shared drive"
      style="display: block; block-size: 380px"
      [columns]="columns"
      [getRowId]="itemId"
      [dataSource]="source"
    />
  `,
})
export class LazyTreeComponent {
  protected readonly columns: ColumnDef<DriveItem>[] = [
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
  protected readonly itemId = (item: DriveItem) => item.id;
  // Created once: a new source starts again, without the folders' entries it loaded.
  protected readonly source = createDriveSource();
}
