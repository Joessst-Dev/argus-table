import { Component, signal } from '@angular/core';
import { ArgusTableComponent } from '@argus-table/angular';
import { byRegion, byRegionAndStatus, saleColumns, sales, type Sale } from '../../data';

@Component({
  selector: 'app-sales',
  imports: [ArgusTableComponent],
  template: `
    <p>
      <label>
        <input type="checkbox" [checked]="byStatus()" (change)="byStatus.set(!byStatus())" />
        Group by status within each region
      </label>
    </p>
    <!-- One group row per region, with its count and the sum of its amounts. -->
    <argus-table
      aria-label="Sales"
      style="display: block; block-size: 380px"
      [columns]="columns"
      [data]="sales"
      [getRowId]="idOf"
      [grouping]="byStatus() ? byRegionAndStatus : byRegion"
    />
  `,
})
export class SalesComponent {
  protected readonly columns = saleColumns;
  protected readonly sales = sales;
  protected readonly byRegion = byRegion;
  protected readonly byRegionAndStatus = byRegionAndStatus;
  protected readonly byStatus = signal(false);
  protected readonly idOf = (sale: Sale) => sale.id;
}
