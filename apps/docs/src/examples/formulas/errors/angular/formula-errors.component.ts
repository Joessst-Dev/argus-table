import { Component } from '@angular/core';
import { formulas } from '@argus-table/formulas';
import { ArgusTableComponent, type ColumnDef } from '@argus-table/angular';
import { dataColumns, itemsOf, type Item } from '../../data';

@Component({
  selector: 'app-formula-errors',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Order items"
      style="display: block; block-size: 320px; --argus-formula-error-fg: #b42318"
      [columns]="columns"
      [data]="data"
      [plugins]="plugins"
    />
  `,
})
export class FormulaErrorsComponent {
  protected readonly columns: ColumnDef<Item>[] = [
    ...dataColumns,
    { id: 'per', header: 'Per piece', formula: '[Unit price] / [Quantity]', width: 110 },
    {
      id: 'safe',
      header: 'Per piece (safe)',
      formula: 'IFERROR(ROUND([Unit price] / [Quantity], 2), "–")',
      width: 150,
    },
    { id: 'missing', header: 'Weight × 2', formula: '[Weight] * 2', width: 110 },
    { id: 'loop', header: 'Loop', formula: '[Loop] + 1', width: 90 },
    { id: 'unknown', header: 'Tax', formula: 'TAX([Unit price])', width: 90 },
  ];
  protected readonly plugins = [formulas<Item>()];
  protected readonly data = itemsOf(5);
}
