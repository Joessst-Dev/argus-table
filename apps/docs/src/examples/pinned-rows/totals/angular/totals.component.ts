import { Component } from '@angular/core';
import { ArgusCellDirective, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { money, orders, totals, type Order } from '../../data';

@Component({
  selector: 'app-totals',
  imports: [ArgusTableComponent, ArgusCellDirective],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="rowId"
      [pinnedRows]="pinnedRows"
    >
      <!-- The template sees pinned, and shows a summary row its own way. -->
      <ng-template argusCell="customer" [argusCellOf]="orders" let-row let-pinned="pinned">
        @if (pinned) {
          <strong>{{ row.customer }}</strong>
        } @else {
          {{ row.customer }}
        }
      </ng-template>
    </argus-table>
  `,
})
export class TotalsComponent {
  protected readonly orders = orders;
  protected readonly pinnedRows = { bottom: [totals] };
  protected readonly rowId = (order: Order) => order.id;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      minWidth: 160,
      sortable: true,
    },
    { id: 'city', header: 'City', accessor: 'city', width: 120 },
    { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 120,
      align: 'end',
      sortable: true,
      cell: (order) => money(order.total),
    },
  ];
}
