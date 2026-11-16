import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import '../../styles.css';
import { orderColumns, orders, type Order } from '../../data';

@Component({
  selector: 'app-parts',
  imports: [ArgusTableComponent],
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
