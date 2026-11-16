import { Component, signal } from '@angular/core';
import {
  ArgusTableComponent,
  type ColumnDef,
  type ColumnPinningState,
  type ColumnVisibilityState,
} from '@argus-table/angular';
import { pinOf, tasks, type PinChoice, type Task } from '../../data';

@Component({
  selector: 'app-controls',
  imports: [ArgusTableComponent],
  template: `
    <form class="column-controls">
      @for (column of columns; track column.id) {
        <fieldset>
          <legend>{{ column.header }}</legend>
          <label>
            <input
              type="checkbox"
              [checked]="shown(column)"
              [disabled]="column.hideable === false"
              (change)="setShown(column, $event)"
            />
            Shown
          </label>
          <label>
            Pin
            <select (change)="setPin(column, $event)">
              @for (choice of choices; track choice) {
                <option [selected]="choice === pinChoice(column)">{{ choice }}</option>
              }
            </select>
          </label>
        </fieldset>
      }
    </form>
    <argus-table
      aria-label="Tasks"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="tasks"
      [(columnVisibility)]="visibility"
      [(columnPinning)]="pinning"
    />
  `,
})
export class ControlsComponent {
  protected readonly tasks = tasks;
  protected readonly choices: PinChoice[] = ['none', 'start', 'end'];
  protected readonly columns: ColumnDef<Task>[] = [
    {
      id: 'id',
      header: '#',
      accessor: 'id',
      width: 70,
      align: 'end',
      pin: 'start',
      hideable: false,
    },
    { id: 'title', header: 'Title', accessor: 'title', width: 180 },
    { id: 'owner', header: 'Owner', accessor: 'owner', width: 110 },
    { id: 'estimate', header: 'Estimate (h)', accessor: 'estimate', width: 120, align: 'end' },
    { id: 'status', header: 'Status', accessor: 'status', width: 120, hidden: true },
  ];
  // Records by column id, over the columns' own `hidden` and `pin`.
  protected readonly visibility = signal<ColumnVisibilityState>({});
  protected readonly pinning = signal<ColumnPinningState>({});

  protected shown(column: ColumnDef<Task>): boolean {
    return this.visibility()[column.id] ?? !column.hidden;
  }

  protected pinChoice(column: ColumnDef<Task>): PinChoice {
    const pin = this.pinning()[column.id];
    return pin === undefined ? (column.pin ?? 'none') : pin || 'none';
  }

  protected setShown(column: ColumnDef<Task>, event: Event): void {
    const shown = (event.target as HTMLInputElement).checked;
    this.visibility.update((v) => ({ ...v, [column.id]: shown }));
  }

  protected setPin(column: ColumnDef<Task>, event: Event): void {
    const choice = (event.target as HTMLSelectElement).value as PinChoice;
    this.pinning.update((p) => ({ ...p, [column.id]: pinOf(choice) }));
  }
}
