import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type SortState } from '@argus-table/angular';
import { headerMenu } from '@argus-table/header-menu';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-controlled-sorting',
  imports: [ArgusTableComponent],
  template: `
    <!-- Controlled: the menu, like a header click, only proposes an order. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      [plugins]="plugins"
      [sorting]="sorting"
      (sortingChange)="proposed.set(json($event))"
    />
    <p>
      <output>Proposed: {{ proposed() }}</output>
    </p>
  `,
})
export class ControlledSortingComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
    { id: 'city', header: 'City', accessor: 'city', width: 140 },
    { id: 'status', header: 'Status', accessor: 'status', width: 120 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  // Created once: a new plugin would reconnect and close an open menu.
  protected readonly plugins = [headerMenu<Order>()];
  protected readonly sorting: SortState = [];
  protected readonly proposed = signal('nothing yet');

  protected json(value: unknown): string {
    return JSON.stringify(value);
  }
}
