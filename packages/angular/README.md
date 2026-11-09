# @argus-table/angular

Angular components for [`<argus-table>`](https://www.npmjs.com/package/argus-table): `ArgusTableComponent` and `ArgusColumnComponent`, with typed inputs, typed outputs and two-way binding. The row type is inferred from `[data]`, and strict templates check your bindings against it.

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)** · [GitHub](https://github.com/Joessst-Dev/argus-table)

## Install

```bash
npm i @argus-table/angular @argus-table/themes
```

`argus-table` comes with it. Angular 20, 21 or 22.

## A first table

The components sit on the element's own tag, so you write `<argus-table>` as usual, with no `CUSTOM_ELEMENTS_SCHEMA`:

```ts
import { Component, input, signal } from '@angular/core';
import { ArgusTableComponent, type ColumnDef, type SortState } from '@argus-table/angular';

interface Order {
  id: string;
  customer: string;
  total: number;
}

@Component({
  selector: 'app-orders',
  imports: [ArgusTableComponent],
  template: `
    <argus-table
      aria-label="Orders"
      style="height: 400px"
      [columns]="columns"
      [data]="orders()"
      [(sorting)]="sorting"
      (rowClick)="open($event.detail.row)"
    />
  `,
})
export class OrdersComponent {
  readonly orders = input.required<Order[]>();
  readonly sorting = signal<SortState>([]);
  readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', width: 90, pin: 'start' },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'total', header: 'Total', accessor: 'total', width: 110, align: 'end', sortable: true },
  ];

  open(order: Order) {}
}
```

Add `@import '@argus-table/themes/default.css';` to your global styles for the default theme.

- **Inputs** set the element's properties: `columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `rowHeight`, `density`, `overscan`, `sorting`, `columnSizing`, `columnOrder`, `selectionMode` and `selection`. Other attributes (`aria-label`, `class`, `style`, …) stay on the element. `null`, as from the `async` pipe, means unset.
- **Outputs** emit the element's `CustomEvent`: `sortChange`, `columnResize`, `columnReorder`, `cellClick`, `rowClick`, `rangeChange` and `loadError`. In `(rowClick)`, `$event.detail.row` has your row type. The details are in the [`argus-table` README](https://www.npmjs.com/package/argus-table).
- **Cells:** a column's `cell` function returns a string, a number, a DOM node or a Lit template. Angular templates in cells are planned.
- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.

## Two-way binding

`[(sorting)]`, `[(columnSizing)]`, `[(columnOrder)]` and `[(selection)]` keep a value in sync with the table; `sortingChange`, `columnSizingChange`, `columnOrderChange` and `selectionChange` emit the new value. The selection event itself is `rowSelect`. Leave one unbound and the table keeps that state itself. A one-way `[sorting]` is controlled: a header click only emits the proposed order, and nothing changes until you set it.

## Methods

A view query gives the component, with `refresh()`, `scrollToRow(index)`, `autosizeColumns(ids?)` and the `element`:

```ts
readonly table = viewChild.required(ArgusTableComponent);

top() {
  void this.table().scrollToRow(0);
}
```

## Columns as children

`ArgusColumnComponent` sits on `<argus-column>`, so columns can come from `@for`. Attributes work as in HTML (`width="90"`, `sortable`, `resizable="false"`), and inputs take values:

```ts
@Component({
  imports: [ArgusTableComponent, ArgusColumnComponent],
  template: `
    <argus-table [data]="orders">
      <argus-column column-id="id" header="Order" accessor="id" width="90" pin="start" />
      @for (c of extra; track c.id) {
        <argus-column [columnId]="c.id" [header]="c.label" [accessor]="c.id" sortable />
      }
    </argus-table>
  `,
})
```

A non-empty `columns` input wins over the children.

## License

MIT
