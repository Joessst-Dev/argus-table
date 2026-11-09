import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { createOrders, currency, statusBadge, type Order } from './data';

@Component({
  selector: 'app-root',
  imports: [ArgusTableComponent],
  // The component sits on the element's own tag: no CUSTOM_ELEMENTS_SCHEMA.
  // In (rowClick), $event.detail.row is an Order.
  template: `
    <h1>Orders</h1>
    <argus-table
      aria-label="Orders"
      [columns]="columns"
      [data]="orders"
      [getRowId]="getRowId"
      (rowClick)="selected.set($event.detail.row)"
    />
    <p role="status">
      @if (selected(); as order) {
        Selected order #{{ order.id }} ({{ order.customer }})
      } @else {
        Click a row.
      }
    </p>
  `,
})
export class AppComponent {
  readonly orders = createOrders();
  readonly selected = signal<Order | undefined>(undefined);
  readonly getRowId = (order: Order) => order.id;

  readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start', cell: (o) => `#${o.id}` },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 120,
      align: 'end',
      sortable: true,
      cell: (o) => currency.format(o.total),
    },
    { id: 'status', header: 'Status', accessor: 'status', width: 120, cell: statusBadge },
  ];
}
