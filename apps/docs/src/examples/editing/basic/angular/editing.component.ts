import { Component, signal } from '@angular/core';
import { applyEdit, cellEditing, type CellEditDetail } from '@argus-table/editing';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-editing',
  imports: [ArgusTableComponent],
  template: `
    <!-- The table never changes data: apply each committed edit. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="data()"
      [getRowId]="rowId"
      [plugins]="plugins"
      (cellEdit)="onCellEdit($event)"
    />
  `,
})
export class EditingComponent {
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    // meta.edit opts a column in; the editor follows its filter kind.
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
      meta: { edit: true },
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: 130,
      filter: 'set',
      filterOptions: ['open', 'paid', 'shipped'],
      meta: { edit: true },
    },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
  ];
  protected readonly rowId = (order: Order) => order.id;
  protected readonly plugins = [cellEditing<Order>()];
  protected readonly data = signal(orders);

  protected onCellEdit(event: CustomEvent<CellEditDetail<Order>>): void {
    this.data.update((rows) => applyEdit(rows, event.detail, this.columns));
  }
}
