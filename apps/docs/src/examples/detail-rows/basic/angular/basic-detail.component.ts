import { Component, signal } from '@angular/core';
import { ARGUS_TABLE } from '@argus-table/angular';
import { columns, idOf, orders } from '../../data';

@Component({
  selector: 'app-basic-detail',
  imports: [ARGUS_TABLE],
  template: `
    <!-- A chevron column appears; a row's panel shows the argusDetail template. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 380px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="idOf"
      [(expanded)]="expanded"
    >
      <ng-template argusDetail [argusDetailOf]="orders" let-row>
        <p class="order-summary">
          {{ row.customer }} in {{ row.city }}, {{ row.status }}: {{ row.total }}
        </p>
      </ng-template>
    </argus-table>
  `,
})
export class BasicDetailComponent {
  protected readonly columns = columns;
  protected readonly orders = orders;
  protected readonly idOf = idOf;
  protected readonly expanded = signal<readonly string[]>(['o2']);
}
