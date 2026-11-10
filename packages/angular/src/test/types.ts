// Template type checks, compiled by `ngc` with strict templates (`pnpm typecheck`).
// Each binding only compiles if the row type is inferred and the inputs and
// outputs carry the element's types.
import { Component, signal } from '@angular/core';
import {
  ArgusColumnComponent,
  ArgusTableComponent,
  type ArgusPlugin,
  type ColumnDef,
  type ColumnPin,
  type ColumnPinningState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type SortState,
} from '../index.js';
import { orders, type Order } from './data.js';

@Component({
  selector: 'argus-types',
  imports: [ArgusTableComponent, ArgusColumnComponent],
  template: `
    <argus-table
      aria-label="Orders"
      density="compact"
      overscan="4"
      [columns]="columns"
      [data]="orders"
      [(sorting)]="sorting"
      [(columnOrder)]="order"
      [(columnPinning)]="pinning"
      [(columnVisibility)]="visibility"
      (columnPin)="takePin($event.detail.pin)"
      (columnHide)="takeFlag($event.detail.hidden)"
      selectionMode="multi"
      selectionCheckboxes
      [(selection)]="selected"
      (rowSelect)="takeIds($event.detail.selection)"
      (columnSizingChange)="takeSizing($event)"
      (rowClick)="takeOrder($event.detail.row)"
      (cellClick)="takeOrder($event.detail.row)"
      (sortChange)="takeSorting($event.detail.sorting)"
      (rangeChange)="takeNumber($event.detail.start)"
      (loadError)="takeUnknown($event.detail.error)"
    >
      <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start" sortable />
      <argus-column columnId="total" width="2fr" minWidth="40" resizable="false" align="end" />
      <argus-column [columnId]="'calc'" [accessor]="total" [width]="'auto'" [sortable]="true" />
    </argus-table>
    <argus-table [data]="rows()" />
    <argus-table [data]="orders" [plugins]="plugins" />
  `,
})
export class TypesComponent {
  readonly orders = orders;
  readonly columns: ColumnDef<Order>[] = [{ id: 'total', accessor: (o) => o.total }];
  readonly sorting = signal<SortState>([]);
  readonly order = signal<string[]>([]);
  readonly pinning = signal<ColumnPinningState>({});
  readonly visibility = signal<ColumnVisibilityState>({});
  readonly selected = signal<string[]>([]);
  readonly rows = signal<Order[] | null>(null);
  readonly total = (o: Order) => o.total;
  readonly plugins: ArgusPlugin<Order>[] = [
    { name: 'totals', columns: (defs) => [...defs, { id: 'x2', accessor: (o) => o.total * 2 }] },
  ];

  takeOrder(order: Order): string {
    return order.id;
  }

  takeIds(ids: string[]): string {
    return ids.join();
  }
  takeSorting(sorting: SortState): number {
    return sorting.length;
  }
  takeSizing(sizing: ColumnSizingState): number {
    return Object.keys(sizing).length;
  }
  takePin(pin: ColumnPin | false): string {
    return String(pin);
  }
  takeFlag(flag: boolean): boolean {
    return flag;
  }
  takeNumber(n: number): number {
    return n;
  }
  takeUnknown(error: unknown): unknown {
    return error;
  }
}
