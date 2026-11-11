import { Component, computed, signal } from '@angular/core';
import { ARGUS_TABLE, type ColumnDef, type SelectionState } from '@argus-table/angular';
import { headerMenu } from '@argus-table/header-menu';
import { createOrders, currency, type Order } from './data';

@Component({
  selector: 'app-root',
  imports: [ARGUS_TABLE],
  // The component sits on the element's own tag: no CUSTOM_ELEMENTS_SCHEMA.
  // A click selects a row; Ctrl/Cmd+click adds one, Shift+click a range.
  // The status cells come from the argusCell template: with [argusCellOf], row is an Order.
  template: `
    <h1>Orders</h1>
    <input
      #box
      type="search"
      placeholder="Search orders"
      aria-label="Search orders"
      (input)="search.set(box.value)"
    />
    <argus-table
      aria-label="Orders"
      [columns]="columns"
      [data]="orders"
      [getRowId]="getRowId"
      [plugins]="plugins"
      [quickFilter]="search()"
      selectionMode="multi"
      selectionCheckboxes
      [(selection)]="selection"
    >
      <ng-template argusCell="status" [argusCellOf]="orders" let-row>
        <span [class]="'status status-' + row.status.toLowerCase()">{{ row.status }}</span>
      </ng-template>
    </argus-table>
    <p role="status">{{ status() }}</p>
  `,
})
export class AppComponent {
  readonly orders = createOrders();
  readonly search = signal('');
  readonly selection = signal<SelectionState>([]);
  readonly getRowId = (order: Order) => order.id;

  // The column menu: sort, filter, pin and hide from the button in each header.
  readonly plugins = [headerMenu<Order>()];

  readonly status = computed(() => {
    const count = this.selection().length;
    if (count === 0) return 'Click a row or its checkbox to select it.';
    return `${String(count)} ${count === 1 ? 'order' : 'orders'} selected`;
  });

  // `filter` lets users filter a column from its menu: text, number, date or a set of values.
  readonly columns: ColumnDef<Order>[] = [
    {
      id: 'id',
      header: 'Order',
      accessor: 'id',
      width: 100,
      pin: 'start',
      cell: (o) => `#${o.id}`,
    },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
      filter: 'text',
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 130,
      align: 'end',
      sortable: true,
      filter: 'number',
      cell: (o) => currency.format(o.total),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: 130,
      sortable: true,
      filter: 'set',
    },
  ];
}
