import { Component, signal, viewChild } from '@angular/core';
import { downloadTable, tableExport, type ExportFormat } from '@argus-table/export';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTableComponent, type ColumnDef, type ColumnGroup } from '@argus-table/angular';
import { formats, orders, type Order } from '../../data';

@Component({
  selector: 'app-export-buttons',
  imports: [ArgusTableComponent],
  template: `
    <div role="toolbar" aria-label="Export" class="example-controls">
      <label>
        Search <input type="search" [value]="search()" (input)="search.set(valueOf($event))" />
      </label>
      <label>
        <input type="checkbox" [checked]="selectedOnly()" (change)="selectedOnly.set(checked($event))" />
        Selected rows only
      </label>
      @for (f of formats; track f.format) {
        <button type="button" (click)="download(f.format)">{{ f.label }}</button>
      }
    </div>
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      selectionMode="multi"
      selectionCheckboxes
      [columns]="columns"
      [columnGroups]="groups"
      [data]="orders"
      [getRowId]="rowId"
      [plugins]="plugins"
      [quickFilter]="search()"
    />
  `,
})
export class ExportButtonsComponent {
  protected readonly table = viewChild.required(ArgusTableComponent);
  protected readonly orders = orders;
  protected readonly formats = formats;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 }, sortable: true },
    { id: 'city', header: 'City', accessor: 'city', width: 120, filter: 'set' },
    { id: 'status', header: 'Status', accessor: 'status', width: 110 },
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
  protected readonly groups: ColumnGroup[] = [{ id: 'where', header: 'Delivery', columns: ['city', 'status'] }];
  protected readonly rowId = (order: Order) => order.id;
  // With headerMenu(), every column menu offers the formats too.
  protected readonly plugins = [
    tableExport<Order>({ filename: 'orders', title: 'Orders' }),
    headerMenu<Order>(),
  ];
  protected readonly search = signal('');
  protected readonly selectedOnly = signal(false);

  // What the table shows: its columns in order, its rows sorted and filtered.
  protected download(format: ExportFormat): void {
    void downloadTable(this.table().element, format, {
      rows: this.selectedOnly() ? 'selected' : 'view',
    });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
