import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { headerMenu } from '@argus-table/header-menu';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-header-menu',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      [plugins]="plugins"
    />
  `,
})
export class HeaderMenuComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140 },
    { id: 'status', header: 'Status', accessor: 'status', width: 120 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  // Created once: a new plugin would reconnect and close an open menu.
  protected readonly plugins = [headerMenu<Order>()];
}
