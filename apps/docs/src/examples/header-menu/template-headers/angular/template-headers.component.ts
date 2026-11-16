import { Component } from '@angular/core';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusHeaderDirective, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-template-headers',
  imports: [ArgusTableComponent, ArgusHeaderDirective],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      [plugins]="plugins"
    >
      <ng-template argusHeader="customer">
        <span>Customer <small>(name)</small></span>
      </ng-template>
    </argus-table>
  `,
})
export class TemplateHeadersComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    // The template renders the header; this text names the column (the menu's "Show Customer").
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
  protected readonly plugins = [headerMenu<Order>()];
}
