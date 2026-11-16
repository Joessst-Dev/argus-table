import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type SelectionState } from '@argus-table/angular';
import { describeSelection, orders, type Order } from '../../data';

@Component({
  selector: 'app-checkboxes',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      selectionMode="multi"
      selectionCheckboxes
      [columns]="columns"
      [data]="orders"
      [getRowId]="rowId"
      [(selection)]="selection"
    />
    <p>
      <output>{{ describe(selection()) }}</output>
    </p>
  `,
})
export class CheckboxesComponent {
  protected readonly orders = orders;
  protected readonly describe = describeSelection;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
    { id: 'city', header: 'City', accessor: 'city', width: 140 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
  ];
  // Selection is by row id.
  protected readonly rowId = (order: Order) => order.id;
  protected readonly selection = signal<SelectionState>([]);
}
