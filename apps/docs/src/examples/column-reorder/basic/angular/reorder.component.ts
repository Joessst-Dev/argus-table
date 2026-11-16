import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { tasks, type Task } from '../../data';

@Component({
  selector: 'app-reorder',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Tasks"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="tasks"
    />
  `,
})
export class ReorderComponent {
  protected readonly tasks = tasks;
  protected readonly columns: ColumnDef<Task>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
    { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
    { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
    { id: 'status', header: 'Status', accessor: 'status', width: 130 },
    { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  ];
}
