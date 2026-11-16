import { Component, signal } from '@angular/core';
import { applyEdit, cellEditing, type CellEditDetail } from '@argus-table/editing';
import { tableExport } from '@argus-table/export';
import { formulas } from '@argus-table/formulas';
import { headerMenu } from '@argus-table/header-menu';
import {
  ArgusTableComponent,
  type AngularColumnDef,
  type FormulaColumnDetail,
} from '@argus-table/angular';
import {
  editingLabels,
  exportLabels,
  formulaLabels,
  menuLabels,
  orders,
  tableLabels,
  type Order,
} from '../../data';

@Component({
  selector: 'app-german',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      lang="de"
      aria-label="Bestellungen"
      style="display: block; block-size: 320px"
      selectionMode="multi"
      selectionCheckboxes
      [columns]="columns()"
      [data]="data()"
      [labels]="labels"
      [plugins]="plugins"
      (cellEdit)="onCellEdit($event)"
      (formulaColumnAdd)="applyColumns($event)"
      (formulaColumnChange)="applyColumns($event)"
      (formulaColumnRemove)="applyColumns($event)"
    />
  `,
})
export class GermanComponent {
  protected readonly data = signal(orders);
  protected readonly labels = tableLabels;
  protected readonly columns = signal<readonly AngularColumnDef<Order>[]>([
    { id: 'id', header: 'Bestellung', accessor: 'id', width: 120, pin: 'start' },
    {
      id: 'customer',
      header: 'Kunde',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
      filter: 'text',
      meta: { edit: true },
    },
    { id: 'city', header: 'Stadt', accessor: 'city', width: 140, filter: 'set' },
    {
      id: 'total',
      header: 'Summe',
      accessor: 'total',
      width: 110,
      align: 'end',
      sortable: true,
      filter: 'number',
    },
    {
      id: 'gross',
      header: 'Brutto',
      formula: 'ROUND([Summe] * 1.19, 2)',
      width: 110,
      sortable: true,
    },
  ]);
  // Each add-on takes its own labels; keys left out stay English.
  protected readonly plugins = [
    tableExport<Order>({ labels: exportLabels }),
    formulas<Order>({ editing: 'edit', labels: formulaLabels }),
    headerMenu<Order>({ labels: menuLabels }),
    cellEditing<Order>({ labels: editingLabels }),
  ];

  // The add-ons propose; this code applies: edits to data, formula columns to columns.
  protected onCellEdit(event: CustomEvent<CellEditDetail<Order>>): void {
    this.data.update((rows) => applyEdit(rows, event.detail, this.columns()));
  }

  protected applyColumns(event: CustomEvent<FormulaColumnDetail<Order>>): void {
    this.columns.set(event.detail.columns);
  }
}
