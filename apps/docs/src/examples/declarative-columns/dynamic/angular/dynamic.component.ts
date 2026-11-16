import { Component, signal } from '@angular/core';
import { ArgusColumnComponent, ArgusTableComponent } from '@argus-table/angular';
import { orders } from '../../data';

@Component({
  selector: 'app-dynamic',
  imports: [ArgusTableComponent, ArgusColumnComponent],
  template: `
    <label>
      <input type="checkbox" [checked]="showCity()" (change)="toggle($event)" />
      Show City
    </label>
    <!-- The table follows its children. -->
    <argus-table aria-label="Orders" style="display: block; block-size: 280px" [data]="orders">
      <argus-column column-id="id" header="Order" accessor="id" width="90" />
      <argus-column column-id="customer" header="Customer" accessor="customer" width="1fr" />
      @if (showCity()) {
        <argus-column column-id="city" header="City" accessor="city" width="120" />
      }
      <argus-column column-id="total" header="Total" accessor="total" width="100" align="end" />
    </argus-table>
  `,
})
export class DynamicComponent {
  protected readonly orders = orders;
  protected readonly showCity = signal(false);

  protected toggle(event: Event): void {
    this.showCity.set((event.target as HTMLInputElement).checked);
  }
}
