import { afterNextRender, Component, computed, effect, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type ColumnSizingState } from '@argus-table/angular';
import { STORAGE_KEY, tasks, type Task } from '../../data';

@Component({
  selector: 'app-saved-widths',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Tasks"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="tasks"
      [(columnSizing)]="sizing"
    />
    <p>
      Saved widths: <output>{{ saved() }}</output>
    </p>
  `,
})
export class SavedWidthsComponent {
  protected readonly tasks = tasks;
  protected readonly columns: ColumnDef<Task>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', resizable: false },
    { id: 'title', header: 'Title', accessor: 'title', width: { flex: 1 }, minWidth: 160 },
    { id: 'owner', header: 'Owner', accessor: 'owner', width: 120, minWidth: 80, maxWidth: 240 },
    { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
  ];
  protected readonly sizing = signal<ColumnSizingState>({});
  protected readonly saved = computed(() => JSON.stringify(this.sizing()));

  constructor() {
    // localStorage exists only in the browser: read it after the first render,
    // then save every change.
    afterNextRender(() => {
      try {
        this.sizing.set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ColumnSizingState);
      } catch {
        this.sizing.set({});
      }
    });
    effect(() => {
      const sizing = this.sizing();
      if (typeof localStorage !== 'undefined' && Object.keys(sizing).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sizing));
      }
    });
  }
}
