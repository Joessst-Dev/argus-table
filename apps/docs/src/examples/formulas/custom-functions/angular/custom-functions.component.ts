import { Component } from '@angular/core';
import { formulas } from '@argus-table/formulas';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { dataColumns, itemsOf, type Item } from '../../data';

@Component({
  selector: 'app-custom-functions',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Order items"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="data"
      [plugins]="plugins"
    />
  `,
})
export class CustomFunctionsComponent {
  protected readonly columns: ColumnDef<Item>[] = [
    ...dataColumns,
    { id: 'net', header: 'Net', formula: '[Unit price] * [Quantity]', width: 100 },
    // VAT is a function of your own; names are case-insensitive.
    { id: 'vat', header: 'VAT', formula: 'ROUND(vat([Net]), 2)', width: 100 },
  ];
  protected readonly plugins = [
    formulas<Item>({
      functions: { VAT: { fn: (net) => Number(net) * 0.19, args: [1, 1], returns: 'number' } },
    }),
  ];
  protected readonly data = itemsOf(20);
}
