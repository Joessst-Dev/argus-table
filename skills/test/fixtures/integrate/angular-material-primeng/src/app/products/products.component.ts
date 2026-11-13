import { Component, signal } from '@angular/core';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';

@Component({
  selector: 'app-products',
  imports: [TableModule],
  template: `
    <p-table
      [value]="products()"
      [lazy]="true"
      (onLazyLoad)="load($event)"
      [paginator]="true"
      [rows]="20"
      [totalRecords]="total()"
      dataKey="id"
      [(selection)]="selected"
      [scrollable]="true"
      scrollHeight="500px"
    >
      <ng-template #header>
        <tr>
          <th style="width: 3rem"><p-tableHeaderCheckbox /></th>
          <th pSortableColumn="name" pFrozenColumn>Name <p-sortIcon field="name" /></th>
          <th pSortableColumn="price">Price <p-sortIcon field="price" /></th>
        </tr>
      </ng-template>
      <ng-template #body let-product>
        <tr>
          <td><p-tableCheckbox [value]="product" /></td>
          <td pFrozenColumn>{{ product.name }}</td>
          <td>{{ product.price }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class ProductsComponent {
  readonly products = signal([]);
  readonly total = signal(0);
  selected = [];
  load(event: TableLazyLoadEvent) {
    console.log(event.first, event.rows, event.sortField);
  }
}
