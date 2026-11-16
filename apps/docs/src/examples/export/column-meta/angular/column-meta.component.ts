import { Component, viewChild } from '@angular/core';
import { downloadTable, tableExport } from '@argus-table/export';
import { ArgusHeaderDirective, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-column-meta',
  imports: [ArgusTableComponent, ArgusHeaderDirective],
  template: `
    <p><button type="button" (click)="download()">Download CSV</button></p>
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 300px"
      [columns]="columns"
      [data]="orders"
      [plugins]="plugins"
    >
      <ng-template argusHeader="customer">
        <span><b>Customer</b> ✦</span>
      </ng-template>
    </argus-table>
  `,
})
export class ColumnMetaComponent {
  protected readonly table = viewChild.required(ArgusTableComponent);
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    // The template renders the header; this text names the column in the files.
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
    { id: 'city', header: 'City', accessor: 'city', width: 120 },
    // Left out of the files.
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: 110,
      meta: { export: { exclude: true } },
    },
    // Shown with cents, exported as whole euros under another header.
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 120,
      align: 'end',
      cell: (order) => `${order.total.toFixed(2)} €`,
      meta: { export: { header: 'Total (EUR)', value: (value) => Math.round(Number(value)) } },
    },
  ];
  protected readonly plugins = [tableExport<Order>({ filename: 'orders' })];

  protected download(): void {
    void downloadTable(this.table().element, 'csv');
  }
}
