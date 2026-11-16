import { Component } from '@angular/core';
import {
  ArgusColumnComponent,
  ArgusColumnGroupComponent,
  ArgusGroupHeaderDirective,
  ArgusTableComponent,
} from '@argus-table/angular';
import { orders } from '../../data';

@Component({
  selector: 'app-declarative-groups',
  imports: [
    ArgusTableComponent,
    ArgusColumnComponent,
    ArgusColumnGroupComponent,
    ArgusGroupHeaderDirective,
  ],
  template: `
    <argus-table
      aria-label="Declarative groups"
      style="display: block; block-size: 300px"
      [data]="rows"
    >
      <argus-column column-id="id" header="Order" accessor="id" width="100" />
      <!-- The header text names the group in text mode; the template renders it. -->
      <argus-column-group group-id="who" header="Who">
        <argus-column column-id="customer" header="Customer" accessor="customer" />
        <argus-column column-id="city" header="City" accessor="city" width="120" />
      </argus-column-group>
      <argus-column column-id="total" header="Total" accessor="total" align="end" />

      <ng-template argusGroupHeader="who">
        <strong>Who</strong>
      </ng-template>
    </argus-table>
  `,
})
export class DeclarativeGroupsComponent {
  protected readonly rows = orders.slice(0, 50);
}
