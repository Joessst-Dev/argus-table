// Template type checks, compiled by `ngc` with strict templates (`pnpm typecheck`).
// Each binding only compiles if the row type is inferred and the inputs and
// outputs carry the element's types.
import { Component, signal } from '@angular/core';
import {
  ArgusColumnComponent,
  ArgusTableComponent,
  type ColumnDef,
  type ColumnSizingState,
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
      selectionMode="multi"
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
  `,
})
export class TypesComponent {
  readonly orders = orders;
  readonly columns: ColumnDef<Order>[] = [{ id: 'total', accessor: (o) => o.total }];
  readonly sorting = signal<SortState>([]);
  readonly order = signal<string[]>([]);
  readonly selected = signal<string[]>([]);
  readonly rows = signal<Order[] | null>(null);
  readonly total = (o: Order) => o.total;

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
  takeNumber(n: number): number {
    return n;
  }
  takeUnknown(error: unknown): unknown {
    return error;
  }
}
