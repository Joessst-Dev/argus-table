import { Component, signal, viewChild, type TemplateRef } from '@angular/core';
import {
  applyEdit,
  cellEditing,
  type CellEditDetail,
  type EditorContext,
} from '@argus-table/editing';
import { ArgusTableComponent, argusTemplate, type AngularColumnDef } from '@argus-table/angular';
import { priorities, tasks, type Task } from '../../data';

@Component({
  selector: 'app-more-editors',
  imports: [ArgusTableComponent],
  template: `
    <!-- A custom editor: a template for the cell while it's edited. The plugin
         focuses its first control; it commits or cancels itself. -->
    <ng-template #priority let-value="value" let-label="label" let-commit="commit">
      <div role="group" [attr.aria-label]="label" style="display: flex; gap: 4px">
        @for (p of priorities; track p) {
          <button
            type="button"
            [attr.aria-label]="'Priority ' + p"
            [attr.aria-pressed]="p === value"
            (click)="commit(p)"
          >
            {{ marks(p) }}
          </button>
        }
      </div>
    </ng-template>
    <argus-table
      aria-label="Tasks"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="data()"
      [getRowId]="rowId"
      [plugins]="plugins"
      (cellEdit)="onCellEdit($event)"
    />
  `,
})
export class MoreEditorsComponent {
  protected readonly priority = viewChild.required<TemplateRef<EditorContext<Task>>>('priority');
  protected readonly priorities = priorities;
  protected readonly columns: AngularColumnDef<Task>[] = [
    { id: 'title', header: 'Task', accessor: 'title', width: { flex: 1 }, meta: { edit: true } },
    // filter: 'date' gives the date editor; a Date stays a Date.
    {
      id: 'due',
      header: 'Due',
      accessor: 'due',
      width: 150,
      filter: 'date',
      cell: (task) => task.due?.toLocaleDateString('en') ?? '',
      meta: { edit: true },
    },
    // Toggled by a click, Space or Enter, with no editing mode.
    {
      id: 'done',
      header: 'Done',
      accessor: 'done',
      width: 80,
      meta: { edit: { editor: 'checkbox' } },
    },
    {
      id: 'priority',
      header: 'Priority',
      accessor: 'priority',
      width: 170,
      cell: (task) => this.marks(task.priority),
      // Called when editing starts, after the template exists.
      meta: { edit: { editor: (context) => argusTemplate(this.priority(), context) } },
    },
  ];
  protected readonly rowId = (task: Task) => task.id;
  protected readonly plugins = [cellEditing<Task>()];
  protected readonly data = signal(tasks);

  protected marks(priority: number): string {
    return '!'.repeat(priority);
  }

  protected onCellEdit(event: CustomEvent<CellEditDetail<Task>>): void {
    this.data.update((rows) => applyEdit(rows, event.detail, this.columns));
  }
}
