import { Component, computed, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type ColumnFilterState } from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-column-filters',
  imports: [ArgusTableComponent],
  template: `
    <p class="example-controls">
      <label>
        Status
        <select (change)="status.set(valueOf($event))">
          <option value="">any</option>
          @for (s of statuses; track s) {
            <option [selected]="s === status()">{{ s }}</option>
          }
        </select>
      </label>
      <label>
        Total at least
        <input type="number" [value]="total()" (input)="total.set(numberOf($event))" />
      </label>
    </p>
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [data]="orders"
      [columnFilters]="filters()"
    />
  `,
})
export class ColumnFiltersComponent {
  protected readonly orders = orders;
  protected readonly statuses = ['open', 'paid', 'shipped'];
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
      filter: 'text',
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140, filter: 'set' },
    { id: 'status', header: 'Status', accessor: 'status', width: 120, filter: 'set' },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 110,
      align: 'end',
      sortable: true,
      filter: 'number',
    },
  ];
  protected readonly status = signal('open');
  protected readonly total = signal(500);
  // A filter per column id; a column left out isn't filtered.
  protected readonly filters = computed<ColumnFilterState>(() => {
    const filters: ColumnFilterState = {};
    const status = this.status();
    const total = this.total();
    if (status) filters.status = { kind: 'set', values: [status] };
    if (!Number.isNaN(total)) filters.total = { kind: 'number', op: 'ge', value: total };
    return filters;
  });

  protected valueOf(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected numberOf(event: Event): number {
    return (event.target as HTMLInputElement).valueAsNumber;
  }
}
