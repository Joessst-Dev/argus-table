import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-wrapped-text',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders with notes"
      style="display: block; block-size: 340px"
      row-height="56"
      [columns]="columns"
      [data]="orders"
    />
  `,
})
export class WrappedTextComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    { id: 'city', header: 'City', accessor: 'city', width: 110 },
    { id: 'status', header: 'Status', accessor: 'status', width: 100 },
    { id: 'total', header: 'Total', accessor: 'total', width: 100, align: 'end' },
    { id: 'note', header: 'Note', accessor: 'note', width: { flex: 1 }, minWidth: 180, wrap: true },
  ];
}
