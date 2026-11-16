import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type SortState } from '@argus-table/angular';
import { orders, type Order } from '../../data';

const describe = (sorting: SortState) => {
  const [sort] = sorting;
  return sort ? `${sort.id} ${sort.desc ? 'descending' : 'ascending'}` : 'nothing';
};

@Component({
  selector: 'app-controlled-sorting',
  imports: [ArgusTableComponent],
  template: `
    <!-- Bound one way (not [(sorting)]): the component decides which proposals to apply. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
      [sorting]="sorting()"
      (sortingChange)="onSortingChange($event)"
    />
    <p>
      <output>{{ message() }}</output>
    </p>
  `,
})
export class ControlledSortingComponent {
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
  protected readonly message = signal(describe(this.sorting()));

  protected onSortingChange(proposed: SortState): void {
    const [sort] = proposed;
    // This page refuses one order; every other proposal is applied.
    if (sort?.id === 'customer' && sort.desc) {
      this.message.set('Refused: customer descending');
      return;
    }
    this.sorting.set(proposed);
    this.message.set(describe(proposed));
  }
}
