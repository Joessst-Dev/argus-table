import { Component, computed, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type SelectionState } from '@argus-table/angular';
import { describeSelection, MAX_SELECTED, orders, type Order } from '../../data';

@Component({
  selector: 'app-controlled-selection',
  imports: [ArgusTableComponent],
  template: `
    <p>
      <button type="button" (click)="clear()">Clear</button>
      <output>{{ refused() }}{{ described() }}</output>
    </p>
    <!-- Controlled one way (not [(selection)]): the table only proposes; this code decides. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      selectionMode="multi"
      [columns]="columns"
      [data]="orders"
      [getRowId]="rowId"
      [selection]="selection()"
      (selectionChange)="onSelectionChange($event)"
    />
  `,
})
export class ControlledSelectionComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
    { id: 'city', header: 'City', accessor: 'city', width: 140 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
  ];
  protected readonly rowId = (order: Order) => order.id;
  protected readonly selection = signal<SelectionState>([]);
  protected readonly refused = signal('');
  protected readonly described = computed(() => describeSelection(this.selection()));

  protected onSelectionChange(proposed: SelectionState): void {
    if (proposed.length > MAX_SELECTED) {
      this.refused.set(
        `Refused ${String(proposed.length)} rows: at most ${String(MAX_SELECTED)}. `,
      );
      return;
    }
    this.selection.set(proposed);
    this.refused.set('');
  }

  protected clear(): void {
    this.selection.set([]);
    this.refused.set('');
  }
}
