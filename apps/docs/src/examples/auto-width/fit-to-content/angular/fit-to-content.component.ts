import { Component, signal, viewChild } from '@angular/core';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { products, type Product } from '../../data';

@Component({
  selector: 'app-fit-to-content',
  imports: [ArgusTableComponent],
  template: `
    <p>
      <button type="button" (click)="fitAll()">Fit all columns</button>
      Resizes: <output>{{ resizes() }}</output>
    </p>
    <!-- A fit is a resize: it fires once for each column it changes. -->
    <argus-table
      aria-label="Products"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="products"
      (columnSizingChange)="resizes.set(resizes() + 1)"
    />
  `,
})
export class FitToContentComponent {
  protected readonly table = viewChild.required(ArgusTableComponent);
  protected readonly products = products;
  protected readonly resizes = signal(0);
  protected readonly columns: ColumnDef<Product>[] = [
    { id: 'sku', header: 'SKU', accessor: 'sku', width: 80, pin: 'start' },
    { id: 'name', header: 'Product', accessor: 'name', width: 80 },
    { id: 'category', header: 'Category', accessor: 'category', width: 80 },
    { id: 'price', header: 'Price (EUR)', accessor: 'price', width: 80, align: 'end' },
  ];

  protected fitAll(): void {
    void this.table().autosizeColumns();
  }
}
