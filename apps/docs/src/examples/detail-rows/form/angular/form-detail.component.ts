import { Component, input, signal } from '@angular/core';
import { ARGUS_TABLE } from '@argus-table/angular';
import { columns, idOf, orders, type Order } from '../../data';

@Component({
  selector: 'app-order-form',
  template: `
    <form class="order-form" (submit)="save($event)">
      <label>Note for {{ order().customer }} <input #note name="note" /></label>
      <button type="submit" (click)="saved.set('Saved: ' + note.value)">Save</button>
      <output>{{ saved() }}</output>
    </form>
  `,
})
export class OrderFormComponent {
  readonly order = input.required<Order>();
  // State in the panel survives scrolling: the panel keeps its component.
  protected readonly saved = signal('');

  protected save(event: Event): void {
    event.preventDefault();
  }
}

@Component({
  selector: 'app-form-detail',
  imports: [ARGUS_TABLE, OrderFormComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="display: block; block-size: 380px"
      [columns]="columns"
      [data]="orders"
      [getRowId]="idOf"
      [(expanded)]="expanded"
    >
      <ng-template argusDetail [argusDetailOf]="orders" let-row>
        <app-order-form [order]="row" />
      </ng-template>
    </argus-table>
  `,
})
export class FormDetailComponent {
  protected readonly columns = columns;
  protected readonly orders = orders;
  protected readonly idOf = idOf;
  protected readonly expanded = signal<readonly string[]>(['o1']);
}
