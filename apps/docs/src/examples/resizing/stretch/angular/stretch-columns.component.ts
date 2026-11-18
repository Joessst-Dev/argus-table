import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { tasks, type Task } from '../../data';

@Component({
  selector: 'app-stretch-columns',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Tasks"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="tasks"
      [stretchColumns]="true"
    />
  `,
})
export class StretchColumnsComponent {
  protected readonly tasks = tasks;
  // Fixed widths, narrower than the table: stretchColumns fills the rest.
  protected readonly columns: ColumnDef<Task>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', maxWidth: 70 },
    { id: 'title', header: 'Title', accessor: 'title', width: 200 },
    { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
    { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  ];
}
