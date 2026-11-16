import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { tasks, type Task } from '../../data';

@Component({
  selector: 'app-resizing',
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
export class ResizingComponent {
  protected readonly tasks = tasks;
  protected readonly columns: ColumnDef<Task>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
    { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
    { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
    { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  ];
}
