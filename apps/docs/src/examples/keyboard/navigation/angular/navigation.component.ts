import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type CellClickDetail, type ColumnDef } from '@argus-table/angular';
import { describeClick, orders, type Order } from '../../data';

@Component({
  selector: 'app-navigation',
  imports: [ArgusTableComponent],
  template: `
    <!-- A click, or Enter on a focused cell. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      (cellClick)="onCellClick($event)"
    />
    <p>
      <output aria-live="polite">{{ log() }}</output>
    </p>
  `,
})
export class NavigationComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  protected readonly log = signal('Click a cell.');

  protected onCellClick(event: CustomEvent<CellClickDetail<Order>>): void {
    this.log.set(describeClick(event.detail));
  }
}
