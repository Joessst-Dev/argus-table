import { Component, ViewEncapsulation } from '@angular/core';
import {
  ArgusCellDirective,
  ArgusHeaderDirective,
  ArgusTableComponent,
  type ColumnDef,
} from '@argus-table/angular';
import { orderColumns, orders, type Order } from '../../data';

@Component({
  selector: 'app-slotted-content',
  imports: [ArgusTableComponent, ArgusCellDirective, ArgusHeaderDirective],
  // The rules style ::part()s and light-DOM content: not scoped to this component.
  styleUrl: '../../styles.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <argus-table
      class="styling-slotted"
      aria-label="Orders"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="orders"
    >
      <!-- Content in the light DOM: the page's .badge classes apply. -->
      <ng-template argusCell="status" [argusCellOf]="orders" let-row>
        <span class="badge" [class]="'badge-' + row.status">{{ row.status }}</span>
      </ng-template>
      <!-- A label for screen readers only. -->
      <ng-template argusHeader="actions">
        <span class="visually-hidden">Actions</span>
      </ng-template>
      <ng-template argusCell="actions" [argusCellOf]="orders" let-row>
        <button type="button" [attr.aria-label]="'Open ' + row.id">Open</button>
      </ng-template>
    </argus-table>
  `,
})
export class SlottedContentComponent {
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    ...orderColumns.filter((column) => column.id !== 'status'),
    // The cells and header come from the templates; 'Actions' names the column.
    { id: 'status', header: 'Status', width: 120 },
    { id: 'actions', header: 'Actions', width: 90, pin: 'end' },
  ];
}
