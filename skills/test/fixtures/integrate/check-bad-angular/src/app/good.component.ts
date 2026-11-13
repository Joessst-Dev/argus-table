import { Component, signal } from '@angular/core';
import { ARGUS_TABLE, type ColumnDef, type SortState } from '@argus-table/angular';
import { headerMenu } from '@argus-table/header-menu';

@Component({
  selector: 'app-good',
  imports: [ARGUS_TABLE],
  templateUrl: './good.component.html',
})
export class GoodComponent {
  readonly orders = [];
  readonly sorting = signal<SortState>([]);
  readonly plugins = [headerMenu()];
  readonly getRowId = (o: { id: string }) => o.id;
  readonly columns: ColumnDef<{ id: string }>[] = [{ id: 'id', header: 'Id', accessor: 'id', sortable: true }];
}
