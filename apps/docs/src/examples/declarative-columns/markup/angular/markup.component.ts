import { Component } from '@angular/core';
import {
  ArgusCellDirective,
  ArgusColumnComponent,
  ArgusTableComponent,
} from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-markup',
  imports: [ArgusTableComponent, ArgusColumnComponent, ArgusCellDirective],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [data]="orders"
      [getRowId]="rowId"
    >
      <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start" />
      <argus-column
        column-id="customer"
        header="Customer"
        accessor="customer"
        width="1fr"
        min-width="160"
        sortable
      />
      <argus-column column-id="city" header="City" accessor="city" width="120" />
      <argus-column column-id="status" header="Status" width="110" />
      <argus-column column-id="total" header="Total" accessor="total" width="100" align="end" sortable />
      <argus-column column-id="actions" header="Actions" width="100" pin="end" resizable="false" />

      <ng-template argusCell="status" [argusCellOf]="orders" let-row>
        <strong>{{ row.status }}</strong>
      </ng-template>
      <ng-template argusCell="actions">
        <button type="button">Open</button>
      </ng-template>
    </argus-table>
  `,
})
export class MarkupComponent {
  protected readonly orders = orders;
  protected readonly rowId = (order: Order) => order.id;
}
