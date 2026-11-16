import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-quick-filter',
  imports: [ArgusTableComponent],
  template: `
    <p>
      <label>
        Search orders
        <input type="search" [value]="search()" (input)="search.set(valueOf($event))" />
      </label>
    </p>
    <!-- Rows that contain every word in one of their shown columns, ignoring case. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [data]="orders"
      [quickFilter]="search()"
    />
  `,
})
export class QuickFilterComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
      filter: 'text',
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
    { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 110,
      align: 'end',
      sortable: true,
      filter: 'number',
    },
  ];
  protected readonly search = signal('');

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
