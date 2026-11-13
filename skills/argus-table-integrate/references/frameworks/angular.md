# Angular: `@argus-table/angular`

Angular 20, 21 or 22, standalone components (NgModule apps import `ARGUS_TABLE` in the module). Install `@argus-table/angular` and `argus-table` (and `@argus-table/themes`) at one version. The components sit on the element's own tags, so no `CUSTOM_ELEMENTS_SCHEMA`.

## Full example

```ts file=src/app/orders.component.ts
import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import {
  ARGUS_TABLE,
  ArgusTableComponent,
  type ColumnDef,
  type SelectionState,
  type SortState,
} from '@argus-table/angular';
import { headerMenu } from '@argus-table/header-menu';

export interface Order {
  id: string;
  customer: string;
  total: number;
  status: 'paid' | 'pending' | 'refunded';
}

const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

@Component({
  selector: 'app-orders',
  imports: [ARGUS_TABLE],
  template: `
    <input #box type="search" aria-label="Search orders" (input)="search.set(box.value)" />
    <argus-table
      aria-label="Orders"
      style="height: 480px"
      [columns]="columns"
      [data]="orders()"
      [getRowId]="getRowId"
      [plugins]="plugins"
      [quickFilter]="search()"
      [(sorting)]="sorting"
      selectionMode="multi"
      selectionCheckboxes
      [(selection)]="selection"
      (rowClick)="open.emit($event.detail.row)"
    >
      <ng-template argusCell="status" [argusCellOf]="orders()" let-row>
        <span [class]="'badge badge-' + row.status">{{ row.status }}</span>
      </ng-template>
    </argus-table>
    <p>
      {{ selectedCount() }} selected
      <button (click)="top()">Back to top</button>
    </p>
  `,
})
export class OrdersComponent {
  readonly orders = input.required<Order[]>();
  readonly open = output<Order>();
  readonly table = viewChild.required(ArgusTableComponent);

  readonly search = signal('');
  readonly sorting = signal<SortState>([{ id: 'id', desc: true }]);
  readonly selection = signal<SelectionState>([]);
  readonly selectedCount = computed(() => this.selection().length);

  // Readonly fields: created once per component, never in a getter or the template.
  readonly getRowId = (order: Order) => order.id;
  readonly plugins = [headerMenu<Order>()];
  readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 110, pin: 'start', sortable: true },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
      filter: 'text',
    },
    {
      id: 'total',
      header: 'Total',
      accessor: 'total',
      width: 120,
      align: 'end',
      sortable: true,
      filter: 'number',
      cell: (order) => money.format(order.total),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      width: 120,
      sortable: true,
      filter: 'set',
    },
  ];

  top() {
    void this.table().scrollToRow(0);
  }
}
```

And in `src/styles.css`: `@import '@argus-table/themes/default.css';`

## Inputs and outputs

- Inputs are the element's properties: `[columns]`, `[data]`, `[getRowId]`, `[dataSource]`, `[plugins]`, `[quickFilter]`, … Simple values can be plain attributes (`selectionMode="multi"`, `density="compact"`, `selectionCheckboxes`). `null` (from the `async` pipe) means unset.
- Two-way state: `[(sorting)]`, `[(selection)]`, `[(columnSizing)]`, `[(columnOrder)]`, `[(columnPinning)]`, `[(columnVisibility)]`, `[(columnFilters)]` with signals. Their outputs (`sortingChange`, …) emit the value. A one-way `[sorting]` is controlled.
- Other outputs emit the `CustomEvent`: `(rowClick)`, `(cellClick)`, `(rangeChange)`, `(loadError)`, `(columnResizeEnd)`; `$event.detail` has the data.
- Never `[plugins]="[headerMenu()]"` or a `get columns()` that builds a new array: change detection would make new instances.

## Content in cells

- `<ng-template argusCell="<column id>" [argusCellOf]="rows" let-row let-value="value">` inside the table; `argusHeader="<id>" let-column` for a header; `argusGroupHeader` for a column group. `[argusCellOf]` types `row` in strict templates.
- From a `cell` function: `cell: (row) => argusTemplate(this.badge, { $implicit: row })` with a `viewChild` template.
- Templates keep the component's bindings and DI. Hold the state they read in signals.
- Cells are pooled: a cell's view gets a new context as the table scrolls. Keep per-row state in the data.

## Methods

`viewChild.required(ArgusTableComponent)` gives `refresh()`, `scrollToRow()`, `scrollToColumn()`, `autosizeColumns()`, `getState()`, `setState()` and `element` (for `downloadTable(this.table().element, 'xlsx')`).

## Columns as children

```html
<argus-table aria-label="Orders" [data]="orders()">
  <argus-column column-id="id" header="Order" accessor="id" width="110" sortable />
  @for (c of extra; track c.id) {
  <argus-column [columnId]="c.id" [header]="c.label" [accessor]="c.id" sortable />
  }
</argus-table>
```

## SSR

With `@angular/ssr`, render the table in the browser only: `@defer (on viewport) { <argus-table …/> } @placeholder { <div style="height: 480px"></div> }`, or an `isPlatformBrowser` check.
