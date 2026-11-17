import { Component, computed, signal } from '@angular/core';
import { ArgusTableComponent } from '@argus-table/angular';
import { itemColumns, items } from '../../data';

@Component({
  selector: 'app-fit-to-content',
  imports: [ArgusTableComponent],
  template: `
    <p class="example-controls">
      <button type="button" (click)="count.set(count() + 1)">Add row</button>
      <button type="button" (click)="count.set(max(0, count() - 1))">Remove row</button>
    </p>
    <!-- As tall as its rows, up to 320px; past that it scrolls. -->
    <argus-table
      aria-label="Line items"
      style="display: block; block-size: auto; max-block-size: 320px"
      [columns]="columns"
      [data]="data()"
    />
  `,
})
export class FitToContentComponent {
  protected readonly columns = itemColumns;
  protected readonly count = signal(4);
  protected readonly data = computed(() => items(this.count()));
  protected readonly max = Math.max;
}
