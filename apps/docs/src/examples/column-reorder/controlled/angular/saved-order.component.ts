import { afterNextRender, Component, computed, effect, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type ColumnOrderState } from '@argus-table/angular';
import { STORAGE_KEY, tasks, type Task } from '../../data';

@Component({
  selector: 'app-saved-order',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Tasks"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="tasks"
      [(columnOrder)]="order"
    />
    <p>
      Saved order: <output>{{ saved() }}</output>
    </p>
  `,
})
export class SavedOrderComponent {
  protected readonly tasks = tasks;
  protected readonly columns: ColumnDef<Task>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', reorderable: false },
    { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
    { id: 'owner', header: 'Owner', accessor: 'owner', width: 120 },
    { id: 'status', header: 'Status', accessor: 'status', width: 130 },
    { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  ];
  protected readonly order = signal<ColumnOrderState>([]);
  protected readonly saved = computed(() => JSON.stringify(this.order()));

  constructor() {
    // localStorage exists only in the browser: read it after the first render,
    // then save every change.
    afterNextRender(() => {
      try {
        this.order.set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ColumnOrderState);
      } catch {
        this.order.set([]);
      }
    });
    effect(() => {
      const order = this.order();
      if (typeof localStorage !== 'undefined' && order.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
      }
    });
  }
}
