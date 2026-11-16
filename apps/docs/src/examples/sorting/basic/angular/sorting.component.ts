import { Component, computed, signal } from '@angular/core';
import {
  ArgusCellDirective,
  ArgusTableComponent,
  type ColumnDef,
  type SortState,
} from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-sorting',
  imports: [ArgusTableComponent, ArgusCellDirective],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      [(sorting)]="sorting"
    >
      <ng-template argusCell="total" [argusCellOf]="orders" let-row>
        <strong>{{ row.total.toFixed(2) }}</strong>
      </ng-template>
    </argus-table>
    <p>
      Sorted by: <output>{{ sortedBy() }}</output>
    </p>
  `,
})
export class SortingComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90 },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'city', header: 'City', accessor: 'city', width: 120, sortable: true },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  protected readonly sorting = signal<SortState>([{ id: 'total', desc: true }]);
  protected readonly sortedBy = computed(() => {
    const [sort] = this.sorting();
    return sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
  });
}
