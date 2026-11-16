import { Component, ViewEncapsulation } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { orderColumns, orders, type Order } from '../../data';

@Component({
  selector: 'app-parts',
  imports: [ArgusTableComponent],
  // The rules style ::part()s and light-DOM content: not scoped to this component.
  styleUrl: '../../styles.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <argus-table
      class="styling-parts"
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
    />
  `,
})
export class PartsComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [...orderColumns];
}
