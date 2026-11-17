import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type RowClickDetail } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-first-table',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="getRowId"
      (rowClick)="select($event.detail)"
    ></argus-table>
    <p>
      <output>{{ selected() ? 'Selected order ' + selected() : 'Click a row.' }}</output>
    </p>
  `,
})
export class FirstTableComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer.name',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  protected readonly getRowId = (order: Order) => order.id;
  protected readonly selected = signal<string | undefined>(undefined);

  protected select(detail: RowClickDetail<Order>) {
    this.selected.set(detail.row.id);
  }
}
