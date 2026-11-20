import { Component } from '@angular/core';
import { ArgusTableComponent } from '@argus-table/angular';
import { byRegionAndStatus, saleColumns, type Sale } from '../../data';
import { createSalesSource } from '../../server';

@Component({
  selector: 'app-server',
  imports: [ArgusTableComponent],
  template: `
    <!-- The server groups: getRows gets grouping and the groupPath of the level it fills. -->
    <argus-table
      aria-label="Sales on the server"
      style="display: block; block-size: 380px"
      [columns]="columns"
      [getRowId]="idOf"
      [grouping]="grouping"
      [dataSource]="source"
    />
  `,
})
export class ServerComponent {
  protected readonly columns = saleColumns;
  protected readonly grouping = byRegionAndStatus;
  // Created once: a new source starts again, without the groups it loaded.
  protected readonly source = createSalesSource();
  protected readonly idOf = (sale: Sale) => sale.id;
}
