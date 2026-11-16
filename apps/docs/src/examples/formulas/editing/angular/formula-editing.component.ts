import { Component, signal } from '@angular/core';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import {
  ArgusTableComponent,
  type AngularColumnDef,
  type FormulaColumnDetail,
} from '@argus-table/angular';
import { dataColumns, items, type Item } from '../../data';

@Component({
  selector: 'app-formula-editing',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Order items"
      style="display: block; block-size: 320px"
      [columns]="columns()"
      [data]="data"
      [plugins]="plugins"
      (formulaColumnAdd)="apply($event)"
      (formulaColumnChange)="apply($event)"
      (formulaColumnRemove)="apply($event)"
    />
  `,
})
export class FormulaEditingComponent {
  protected readonly columns = signal<readonly AngularColumnDef<Item>[]>([
    ...dataColumns,
    // Columns by header or id, in brackets; a formula can read another (Gross reads Total).
    {
      id: 'total',
      header: 'Total',
      formula: '[Unit price] * [Quantity] * (1 - [Discount])',
      width: 110,
      sortable: true,
    },
    { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)', width: 110, sortable: true },
    { id: 'stock', header: 'Stock', formula: 'IF([qty] < 10, "Low", "OK")', width: 90 },
    { id: 'month', header: 'Month', formula: 'TEXT([Ordered], "mmm yyyy")', width: 110 },
  ]);
  protected readonly plugins = [formulas<Item>({ editing: 'edit' }), headerMenu<Item>()];
  protected readonly data = items;

  // The plugin never changes columns itself: it proposes them, and this code applies them.
  protected apply(event: CustomEvent<FormulaColumnDetail<Item>>): void {
    this.columns.set(event.detail.columns);
  }
}
