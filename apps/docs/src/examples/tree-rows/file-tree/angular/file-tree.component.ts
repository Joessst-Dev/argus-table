import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type TreeExpandedState } from '@argus-table/angular';
import { entriesOf, fileColumns, files, folderIds } from '../../data';

@Component({
  selector: 'app-file-tree',
  imports: [ArgusTableComponent],
  template: `
    <!-- The table has no "expand all" of its own: set treeExpanded. -->
    <p>
      <button type="button" (click)="treeExpanded.set(folderIds)">Expand all</button>
      <button type="button" (click)="treeExpanded.set([])">Collapse all</button>
    </p>
    <!-- A folder's entries are its child rows, indented under it in the Name column. -->
    <argus-table
      aria-label="Files"
      style="display: block; block-size: 380px"
      [columns]="columns"
      [data]="files"
      [getSubRows]="entriesOf"
      [(treeExpanded)]="treeExpanded"
    />
  `,
})
export class FileTreeComponent {
  protected readonly columns = fileColumns;
  protected readonly files = files;
  protected readonly entriesOf = entriesOf;
  protected readonly folderIds = folderIds;
  protected readonly treeExpanded = signal<TreeExpandedState>(['0']);
}
