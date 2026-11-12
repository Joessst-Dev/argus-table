// Template type checks, compiled by `ngc` with strict templates (`pnpm typecheck`).
// Each binding only compiles if the row type is inferred and the inputs and
// outputs carry the element's types.
import { Component, signal } from '@angular/core';
import {
  ARGUS_TABLE,
  ArgusColumnComponent,
  ArgusTableComponent,
  type ArgusPlugin,
  type ColumnDef,
  type ColumnFilter,
  type ColumnFilterState,
  type ColumnPin,
  type ColumnPinningState,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type SortState,
} from '../index.js';
import { orders, type Order } from './data.js';

@Component({
  selector: 'argus-types',
  imports: [ArgusTableComponent, ArgusColumnComponent, ARGUS_TABLE],
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
      (argus-column-pinning-change)="takePin($event.detail.pin)"
      (argus-column-visibility-change)="takeFlag($event.detail.visible)"
      [(columnFilters)]="filters"
      quickFilter="berlin"
      (argus-column-filters-change)="takeFilter($event.detail.columnFilter)"
      selectionMode="multi"
      selectionCheckboxes
      [(selection)]="selected"
      (argus-selection-change)="takeIds($event.detail.selection)"
      (columnSizingChange)="takeSizing($event)"
      (rowClick)="takeOrder($event.detail.row)"
      (cellClick)="takeOrder($event.detail.row)"
      (argus-sorting-change)="takeSorting($event.detail.sorting)"
      (rangeChange)="takeNumber($event.detail.first)"
      (loadError)="takeUnknown($event.detail.error)"
    >
      <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start" sortable />
      <argus-column columnId="total" width="2fr" minWidth="40" resizable="false" align="end" />
      <argus-column [columnId]="'calc'" [accessor]="total" [width]="'auto'" [sortable]="true" />
      <argus-column column-id="status" filter="set" [filterOptions]="['open', 'paid']" />
    </argus-table>
    <argus-table [data]="rows()" />
    <argus-table [data]="orders">
      <!-- With argusCellOf, let-row has the row type. -->
      <ng-template
        argusCell="total"
        [argusCellOf]="orders"
        let-row
        let-value="value"
        let-id="rowId"
      >
        {{ row.total.toFixed(2) }} {{ value }} {{ id.length }}
      </ng-template>
      <ng-template argusHeader="total" let-column>{{ column.toUpperCase() }}</ng-template>
    </argus-table>
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
  readonly filters = signal<ColumnFilterState>({});
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
  takeFilter(filter: ColumnFilter | undefined): string | undefined {
    return filter?.kind;
  }
  takeNumber(n: number): number {
    return n;
  }
  takeUnknown(error: unknown): unknown {
    return error;
  }
}
