import { Component, computed, signal } from '@angular/core';
import {
  ArgusTableComponent,
  type ColumnDef,
  type ColumnGroup,
  type ColumnSizingState,
} from '@argus-table/angular';
import { orders, type Order } from '../../data';

@Component({
  selector: 'app-resize-groups',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Resize groups"
      style="display: block; block-size: 300px"
      [columns]="columns"
      [columnGroups]="groups"
      [data]="orders"
      (columnSizingChange)="sizing.set($event)"
    />
    <p>
      columnSizing: <output>{{ shown() }}</output>
    </p>
  `,
})
export class ResizeGroupsComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: 160, sortable: true },
    { id: 'city', header: 'City', accessor: 'city', width: 120 },
    { id: 'status', header: 'Status', accessor: 'status', width: 110 },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];
  protected readonly groups: ColumnGroup[] = [
    // reorderable: false keeps the group in place; its columns still move within it.
    { id: 'who', header: 'Who', columns: ['customer', 'city'], reorderable: false },
    { id: 'state', header: 'Order state', columns: ['status', 'total'] },
  ];
  // A group resize is a resize of its columns: one event per column.
  protected readonly sizing = signal<ColumnSizingState>({});
  protected readonly shown = computed(() => JSON.stringify(this.sizing()));
}
