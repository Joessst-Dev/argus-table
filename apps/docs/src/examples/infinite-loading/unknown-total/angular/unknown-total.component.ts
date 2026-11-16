import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { createSource, type Order } from '../../data';

@Component({
  selector: 'app-unknown-total',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [dataSource]="source"
    />
  `,
})
export class UnknownTotalComponent {
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
  // Created once: a new source starts again from an empty cache.
  protected readonly source = createSource({ rows: 2350, total: false });
}
