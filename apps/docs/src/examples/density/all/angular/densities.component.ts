import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { densities, orders, type Order } from '../../data';

@Component({
  selector: 'app-densities',
  imports: [ArgusTableComponent],
  template: `
    @for (density of densities; track density) {
      <section>
        <p>{{ density }}</p>
        <argus-table
          [attr.aria-label]="'Orders, ' + density"
          style="display: block; block-size: 160px"
          [density]="density"
          [columns]="columns"
          [data]="orders"
        />
      </section>
    }
  `,
})
export class DensitiesComponent {
  protected readonly densities = densities;
  protected readonly orders = orders;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90 },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: { flex: 1 } },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end' },
  ];
}
