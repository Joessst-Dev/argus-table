import { Component, computed, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type RowClickDetail } from '@argus-table/angular';
import { average, money, orders, totals, type Order } from '../../data';

@Component({
  selector: 'app-top-and-bottom',
  imports: [ArgusTableComponent],
  template: `
    <p>
      <label>
        <input type="checkbox" [checked]="top()" (change)="top.set(checked($event))" />
        Average row on top
      </label>
      <label>
        <input type="checkbox" [checked]="bottom()" (change)="bottom.set(checked($event))" />
        Totals row at the bottom
      </label>
    </p>
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="rowId"
      [pinnedRows]="pinnedRows()"
      (rowClick)="onRowClick($event)"
    />
    <p>
      <output aria-live="polite">{{ log() }}</output>
    </p>
  `,
})
export class TopAndBottomComponent {
  protected readonly orders = orders;
  protected readonly rowId = (order: Order) => order.id;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      minWidth: 160,
      sortable: true,
    },
    { id: 'city', header: 'City', accessor: 'city', width: 120 },
    { id: 'items', header: 'Items', accessor: 'items', width: 90, align: 'end', sortable: true },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 120,
      align: 'end',
      sortable: true,
      cell: (order) => money(order.total),
    },
  ];
  protected readonly top = signal(true);
  protected readonly bottom = signal(true);
  protected readonly pinnedRows = computed(() => ({
    top: this.top() ? [average] : [],
    bottom: this.bottom() ? [totals] : [],
  }));
  protected readonly log = signal('Click a row.');

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  // A click or Enter on a pinned row says which side it's on.
  protected onRowClick(event: CustomEvent<RowClickDetail<Order>>): void {
    const { rowId, pinned } = event.detail;
    this.log.set(`argus-row-click: ${rowId}${pinned ? ` (pinned: ${pinned})` : ''}`);
  }
}
