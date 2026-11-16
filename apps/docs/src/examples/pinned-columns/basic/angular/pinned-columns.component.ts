import { Component, signal } from '@angular/core';
import { ArgusCellDirective, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { items, months, shadows, type Item } from '../../data';

@Component({
  selector: 'app-pinned-columns',
  imports: [ArgusTableComponent, ArgusCellDirective],
  template: `
    <p>
      <label>
        <input type="checkbox" [checked]="rtl()" (change)="rtl.set(checked($event))" />
        Right to left
      </label>
      <label>
        Edge shadow
        <select (change)="shadow.set(selected($event))">
          @for (name of shadowNames; track name) {
            <option>{{ name }}</option>
          }
        </select>
      </label>
    </p>
    <!-- 'start' follows the writing direction: the right side in RTL. -->
    <argus-table
      aria-label="Items"
      style="display: block; block-size: 320px"
      [attr.dir]="rtl() ? 'rtl' : 'ltr'"
      [style.--argus-pinned-shadow]="shadows[shadow()] || null"
      [columns]="columns"
      [data]="items"
    >
      <ng-template argusCell="actions">
        <button type="button">Open</button>
      </ng-template>
    </argus-table>
  `,
})
export class PinnedColumnsComponent {
  protected readonly items = items;
  protected readonly shadows = shadows;
  protected readonly shadowNames = Object.keys(shadows) as (keyof typeof shadows)[];
  protected readonly rtl = signal(false);
  protected readonly shadow = signal<keyof typeof shadows>('Theme');
  protected readonly columns: ColumnDef<Item>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
    { id: 'name', header: 'Name', accessor: 'name', width: 140, pin: 'start' },
    ...months,
    // The cells come from the argusCell template.
    { id: 'actions', header: 'Actions', width: 90, pin: 'end' },
  ];

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected selected(event: Event): keyof typeof shadows {
    return (event.target as HTMLSelectElement).value as keyof typeof shadows;
  }
}
