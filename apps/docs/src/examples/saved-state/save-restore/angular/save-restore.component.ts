import { Component, signal, viewChild } from '@angular/core';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { load, orders, store, type Order } from '../../data';

const STORAGE_KEY = 'argus-docs:saved-state:angular';

@Component({
  selector: 'app-save-restore',
  imports: [ArgusTableComponent],
  template: `
    <p class="example-controls">
      <button type="button" (click)="save()">Save</button>
      <button type="button" (click)="restore()">Restore</button>
      <button type="button" (click)="forget()">Forget</button>
      <output aria-live="polite">{{ status() }}</output>
    </p>
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 320px"
      selectionMode="multi"
      [columns]="columns"
      [data]="orders"
      [getRowId]="rowId"
      [plugins]="plugins"
    />
  `,
})
export class SaveRestoreComponent {
  protected readonly table = viewChild.required(ArgusTableComponent);
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      minWidth: 160,
      sortable: true,
      filter: 'text',
    },
    { id: 'city', header: 'City', accessor: 'city', width: 140, sortable: true, filter: 'set' },
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
  protected readonly rowId = (order: Order) => order.id;
  // The column menu (sort, filter, pin, hide), created once.
  protected readonly plugins = [headerMenu<Order>()];
  protected readonly status = signal('');

  protected save(): void {
    store(STORAGE_KEY, this.table().getState());
    this.status.set('Saved.');
  }

  protected restore(): void {
    const saved = load(STORAGE_KEY);
    if (!saved) {
      this.status.set('Nothing saved yet.');
      return;
    }
    void this.table()
      .setState(saved)
      .then(() => {
        this.status.set('Restored.');
      });
  }

  protected forget(): void {
    store(STORAGE_KEY, undefined);
    this.status.set('Forgotten.');
  }
}
