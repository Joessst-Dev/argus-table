import { Component } from '@angular/core';
import { ArgusCellDirective, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { barHeight, orders, totals, type Order } from '../../data';

@Component({
  selector: 'app-auto-rows',
  imports: [ArgusTableComponent, ArgusCellDirective],
  template: `
    <argus-table
      aria-label="Orders with notes, rows fit their content"
      style="display: block; block-size: 400px"
      row-height="auto"
      [columns]="columns"
      [data]="orders"
      [pinnedRows]="pinnedRows"
    >
      <!-- Content taller than a line: the row grows to fit it. -->
      <ng-template argusCell="bar" [argusCellOf]="orders" let-row>
        <div class="bar" [style.block-size.px]="barHeight(row)"></div>
      </ng-template>
    </argus-table>
  `,
})
export class AutoRowsComponent {
  protected readonly orders = orders;
  protected readonly pinnedRows = { bottom: [totals] };
  protected readonly barHeight = barHeight;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    { id: 'city', header: 'City', accessor: 'city', width: 110 },
    { id: 'status', header: 'Status', accessor: 'status', width: 100 },
    { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
    { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
    // The cells come from the argusCell template.
    { id: 'bar', header: 'Bar', width: 70 },
  ];
}
