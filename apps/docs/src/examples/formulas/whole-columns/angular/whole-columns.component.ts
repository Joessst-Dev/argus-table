import { Component } from '@angular/core';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTableComponent, type ColumnDef, type SortState } from '@argus-table/angular';
import { dataColumns, items, type Item } from '../../data';

@Component({
  selector: 'app-whole-columns',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Order items"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [data]="data"
      [plugins]="plugins"
      [sorting]="sorting"
    />
  `,
})
export class WholeColumnsComponent {
  protected readonly columns: ColumnDef<Item>[] = [
    // Product gets a filter kind: Filter… in its menu.
    { ...dataColumns[0], filter: 'set' },
    ...dataColumns.slice(1, 4),
    {
      id: 'total',
      header: 'Total',
      formula: '[Unit price] * [Quantity] * (1 - [Discount])',
      width: 100,
      sortable: true,
    },
    // [[name]] is a whole column: every row the filters keep.
    {
      id: 'share',
      header: 'Share %',
      formula: 'ROUND([Total] / SUM([[Total]]) * 100, 3)',
      width: 100,
      sortable: true,
    },
    {
      id: 'orders',
      header: 'Orders of product',
      formula: 'COUNTIF([[Product]], [Product])',
      width: 150,
    },
    { id: 'rank', header: 'Rank', formula: 'RANK([Total], [[Total]])', width: 80, sortable: true },
    {
      id: 'best',
      header: 'Best seller',
      formula: 'INDEX([[Product]], MATCH(MAX([[Total]]), [[Total]], 0))',
      width: 130,
    },
  ];
  protected readonly plugins = [formulas<Item>(), headerMenu<Item>()];
  protected readonly data = items;
  protected readonly sorting: SortState = [{ id: 'rank', desc: false }];
}
