import { Component, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type LoadErrorDetail } from '@argus-table/angular';
import { createSource, type Order } from '../../data';

@Component({
  selector: 'app-failed-page',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [dataSource]="source"
      (loadError)="onLoadError($event)"
    />
    <p>
      <output role="status">{{ log() }}</output>
    </p>
  `,
})
export class FailedPageComponent {
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
  protected readonly source = createSource({ failOnce: true });
  protected readonly log = signal('');

  // A failed page fires argus-load-error, and its rows show a Retry button.
  protected onLoadError(event: CustomEvent<LoadErrorDetail>): void {
    const { error, start, end } = event.detail;
    this.log.set(`argus-load-error: rows ${String(start)}–${String(end)}, ${String(error)}`);
  }
}
