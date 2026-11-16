import { Component } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { products, type Product } from '../../data';

@Component({
  selector: 'app-auto-columns',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Products"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="products"
    />
  `,
})
export class AutoColumnsComponent {
  protected readonly products = products;
  protected readonly columns: ColumnDef<Product>[] = [
    { id: 'sku', header: 'SKU', accessor: 'sku', width: 'auto', pin: 'start' },
    { id: 'name', header: 'Product', accessor: 'name', width: 'auto', maxWidth: 360 },
    { id: 'category', header: 'Category', accessor: 'category', width: 'auto' },
    { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
  ];
}
