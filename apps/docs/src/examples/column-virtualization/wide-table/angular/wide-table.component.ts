import { Component } from '@angular/core';
import { ArgusCellDirective, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { items, valueColumns, type Item } from '../../data';

@Component({
  selector: 'app-wide-table',
  imports: [ArgusTableComponent, ArgusCellDirective],
  template: `
    <argus-table
      aria-label="Wide table"
      style="display: block; block-size: 340px"
      virtualizeColumns
      [columns]="columns"
      [data]="items"
    >
      <ng-template argusCell="actions">
        <button type="button">Open</button>
      </ng-template>
    </argus-table>
  `,
})
export class WideTableComponent {
  protected readonly items = items;
  protected readonly columns: ColumnDef<Item>[] = [
    { id: 'id', header: '#', accessor: 'id', width: 70, align: 'end', pin: 'start' },
    { id: 'name', header: 'Name', accessor: 'name', width: 120, pin: 'start' },
    ...valueColumns,
    // The cells come from the argusCell template.
    { id: 'actions', header: 'Actions', width: 90, pin: 'end' },
  ];
}
