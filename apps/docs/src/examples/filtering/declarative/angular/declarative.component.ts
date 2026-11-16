import { Component } from '@angular/core';
import {
  ArgusColumnComponent,
  ArgusTableComponent,
  type ColumnFilterState,
} from '@argus-table/angular';
import { orders } from '../../data';

@Component({
  selector: 'app-declarative',
  imports: [ArgusTableComponent, ArgusColumnComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 280px"
      [data]="rows"
      [columnFilters]="filters"
    >
      <argus-column column-id="id" header="Order" accessor="id" width="100" />
      <argus-column column-id="customer" header="Customer" accessor="customer" filter="text" />
      <argus-column column-id="city" header="City" accessor="city" filter="set" />
    </argus-table>
  `,
})
export class DeclarativeComponent {
  protected readonly rows = orders.slice(0, 200);
  protected readonly filters: ColumnFilterState = { city: { kind: 'set', values: ['Quito'] } };
}
