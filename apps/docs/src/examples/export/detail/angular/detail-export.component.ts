import { Component, viewChild } from '@angular/core';
import { downloadTable, tableExport, type ExportDetail } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { ARGUS_TABLE, ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { linesOf, orders, type Line, type Order } from '../../data';

@Component({
  selector: 'app-detail-export',
  imports: [ARGUS_TABLE],
  template: `
    <p>
      <button type="button" (click)="download('csv')">CSV with lines</button>
      <button type="button" (click)="download('xlsx')">Excel with lines</button>
    </p>
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="idOf"
      [plugins]="plugins"
    >
      <ng-template argusDetail [argusDetailOf]="orders" let-row>
        <ul>
          @for (line of linesOf(row); track $index) {
            <li>{{ line.quantity }} × {{ line.product }}</li>
          }
        </ul>
      </ng-template>
    </argus-table>
  `,
})
export class DetailExportComponent {
  protected readonly table = viewChild.required(ArgusTableComponent);
  protected readonly orders = orders;
  protected readonly linesOf = linesOf;
  protected readonly idOf = (order: Order) => order.id;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
    { id: 'city', header: 'City', accessor: 'city', width: 120 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
  ];
  // Every exported order's lines: under it in Excel and PDF, one CSV line each.
  private readonly detail: ExportDetail<Order, Line> = {
    columns: [
      { id: 'product', header: 'Product', width: 160 },
      { id: 'quantity', header: 'Qty', align: 'end', width: 60 },
      { id: 'price', header: 'Price', align: 'end', width: 80 },
    ],
    rows: (order) => linesOf(order),
  };
  // The column menu offers Export and Export with details.
  protected readonly plugins = [
    tableExport<Order>({ filename: 'orders', detail: this.detail }),
    headerMenu<Order>(),
  ];

  protected download(format: 'csv' | 'xlsx'): void {
    void downloadTable(this.table().element, format);
  }
}
