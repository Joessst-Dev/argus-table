import { Component, computed, input, signal } from '@angular/core';
import { ARGUS_TABLE } from '@argus-table/angular';
import { columns, idOf, lineColumns, linesOf, orders, type Order } from '../../data';

@Component({
  selector: 'app-order-lines',
  imports: [ARGUS_TABLE],
  template: `
    <!-- As tall as its rows, up to 240px; past that it scrolls. -->
    <argus-table
      [attr.aria-label]="'Lines of ' + order().id"
      style="display: block; block-size: auto; max-block-size: 240px"
      [columns]="columns"
      [data]="lines()"
    />
  `,
})
export class OrderLinesComponent {
  readonly order = input.required<Order>();
  protected readonly columns = lineColumns;
  protected readonly lines = computed(() => linesOf(this.order()));
}

@Component({
  selector: 'app-nested-table',
  imports: [ARGUS_TABLE, OrderLinesComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 440px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="idOf"
      [(expanded)]="expanded"
    >
      <ng-template argusDetail [argusDetailOf]="orders" let-row>
        <app-order-lines [order]="row" />
      </ng-template>
    </argus-table>
  `,
})
export class NestedTableComponent {
  protected readonly columns = columns;
  protected readonly orders = orders;
  protected readonly idOf = idOf;
  protected readonly expanded = signal<readonly string[]>(['o1', 'o3']);
}
