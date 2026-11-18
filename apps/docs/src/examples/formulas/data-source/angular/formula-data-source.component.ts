import { Component, signal, viewChild } from '@angular/core';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import { ArgusTableComponent, type ColumnDef, type ColumnFilterState } from '@argus-table/angular';
import { dataColumns, type Item } from '../../data';
import { createFormulaSource, describe } from '../../server';

@Component({
  selector: 'app-formula-data-source',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Order items"
      style="display: block; block-size: 320px"
      [columns]="columns"
      [dataSource]="source"
      [getRowId]="rowId"
      [plugins]="plugins"
      [(columnFilters)]="filters"
    />
    <p>
      Last request: <output>{{ last() }}</output>
    </p>
  `,
})
export class FormulaDataSourceComponent {
  protected readonly table = viewChild(ArgusTableComponent);
  protected readonly columns: ColumnDef<Item>[] = [
    ...dataColumns,
    {
      id: 'total',
      header: 'Line total',
      formula: 'ROUND([Unit price] * [Quantity] * (1 - [Discount]), 2)',
      width: 120,
      sortable: true,
      filter: 'number',
    },
    {
      id: 'size',
      header: 'Order size',
      formula: 'IF([Quantity] >= 10, "bulk", "single")',
      width: 120,
      sortable: true,
      filter: 'text',
    },
  ];
  // `server: true`: the server sorts and filters by the formulas' trees.
  protected readonly plugins = [formulas<Item>({ server: true }), headerMenu<Item>()];
  // Starts filtered; the column menu changes it.
  protected readonly filters = signal<ColumnFilterState>({
    total: { kind: 'number', op: 'ge', value: 200 },
  });
  protected readonly rowId = (item: Item) => item.id;
  protected readonly last = signal('');
  // Created once: getRows sends `formulaTrees(table)` with each request.
  protected readonly source = createFormulaSource(
    () => this.table()?.element,
    (request) => {
      this.last.set(describe(request));
    },
  );
}
