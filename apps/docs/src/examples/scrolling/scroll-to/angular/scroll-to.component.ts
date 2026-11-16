import { Component, signal, viewChild } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type ScrollAlign } from '@argus-table/angular';
import { aligns, months, orders, type Order } from '../../data';

@Component({
  selector: 'app-scroll-to',
  imports: [ArgusTableComponent],
  template: `
    <p class="example-controls">
      <label>
        Order id <input [value]="rowId()" size="8" (input)="rowId.set(valueOf($event))" />
      </label>
      <button type="button" (click)="toRow()">Scroll to row</button>
      <label>
        Column
        <select (change)="column.set(valueOf($event))">
          @for (c of columns; track c.id) {
            <option [value]="c.id" [selected]="c.id === column()">{{ c.header }}</option>
          }
        </select>
      </label>
      <button type="button" (click)="toColumn()">Scroll to column</button>
      <label>
        Align
        <select (change)="align.set(alignOf($event))">
          @for (a of aligns; track a) {
            <option [selected]="a === align()">{{ a }}</option>
          }
        </select>
      </label>
      <output aria-live="polite">{{ result() }}</output>
    </p>
    <!-- Rows by id need getRowId. -->
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 340px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="idOf"
    />
  `,
})
export class ScrollToComponent {
  protected readonly table = viewChild.required(ArgusTableComponent);
  protected readonly orders = orders;
  protected readonly aligns = aligns;
  protected readonly idOf = (order: Order) => order.id;
  protected readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 100, pin: 'start' },
    { id: 'customer', header: 'Customer', accessor: 'customer', width: 160 },
    ...months,
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', pin: 'end' },
  ];
  protected readonly rowId = signal('o50000');
  protected readonly column = signal('m15');
  protected readonly align = signal<ScrollAlign>('center');
  protected readonly result = signal('');

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected alignOf(event: Event): ScrollAlign {
    return this.valueOf(event) as ScrollAlign;
  }

  // Both methods resolve true once the target is in view, false when there's none.
  protected toRow(): void {
    this.result.set('Scrolling…');
    void this.table()
      .scrollToRow({ id: this.rowId() }, { align: this.align() })
      .then((found) => {
        this.show(found);
      });
  }

  protected toColumn(): void {
    this.result.set('Scrolling…');
    void this.table()
      .scrollToColumn(this.column(), { align: this.align() })
      .then((found) => {
        this.show(found);
      });
  }

  private show(found: boolean): void {
    this.result.set(found ? 'Scrolled.' : 'Not found.');
  }
}
