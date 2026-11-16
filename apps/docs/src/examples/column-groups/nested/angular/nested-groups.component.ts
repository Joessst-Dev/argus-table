import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type ColumnGroup } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-nested-groups',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders with nested groups"
      style="display: block; block-size: 300px"
      [columns]="columns"
      [columnGroups]="groups"
      [data]="orders"
    />
  `,
})
export class NestedGroupsComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
    { id: 'city', header: 'City', accessor: 'city', width: 120 },
    { id: 'status', header: 'Status', accessor: 'status', width: 110 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  protected readonly groups: ColumnGroup[] = [
    {
      id: 'who',
      header: 'Who',
      // A group inside a group: one more header row.
      columns: ['customer', { id: 'shipping', header: 'Shipping', columns: ['city'] }],
    },
    { id: 'state', header: 'Order state', columns: ['status', 'total'] },
  ];
}
