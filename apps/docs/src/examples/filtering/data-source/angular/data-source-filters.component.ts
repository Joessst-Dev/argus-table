import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type ColumnFilterState } from '@argus-table/angular';
import { createSource, describe, type Order } from '../../data';

@Component({
  selector: 'app-data-source-filters',
  imports: [ArgusTableComponent],
  template: `
    <!-- The table doesn't filter a data source's rows: it sends the filters to getRows. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 300px"
      [columns]="columns"
      [dataSource]="source"
      [columnFilters]="filters"
      quickFilter="customer 9"
    />
    <p>
      Last request: <output>{{ last() }}</output>
    </p>
  `,
})
export class DataSourceFiltersComponent {
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      filter: 'text',
    },
    // The table can't see every value of a remote column: list the set filter's options.
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: 120,
      filter: 'set',
      filterOptions: ['open', 'paid', 'shipped'],
    },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
  ];
  protected readonly filters: ColumnFilterState = { status: { kind: 'set', values: ['shipped'] } };
  protected readonly last = signal('');
  // Created once: a new source starts again from an empty cache.
  protected readonly source = createSource((request) => {
    this.last.set(describe(request));
  });
}
