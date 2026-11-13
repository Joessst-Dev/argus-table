import { CUSTOM_ELEMENTS_SCHEMA, Component, signal } from '@angular/core';
import { headerMenu } from '@argus-table/header-menu';
import type { ColumnDef, SelectionState } from '@argus-table/angular';

@Component({
  selector: 'app-raw',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <argus-table
      aria-label="Orders"
      [columns]="columns"
      [data]="orders"
      [plugins]="[headerMenu()]"
      [selection]="selection()"
      (rowClicked)="open($event)"
    />
  `,
})
export class RawComponent {
  readonly headerMenu = headerMenu;
  readonly orders = [];
  readonly selection = signal<SelectionState>([]);
  readonly columns: ColumnDef<{ id: string }>[] = [{ id: 'id', header: 'Id', accessor: 'id', sortable: true }];
  open(_event: unknown) {}
}
