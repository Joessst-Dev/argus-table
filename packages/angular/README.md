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

- **Inputs** set the element's properties: `columns`, `data`, `dataSource`, `pinnedRows`, `getRowId`, `rowHeight`, `density`, `overscan`, `virtualizeColumns`, `sorting`, `columnSizing`, `columnOrder`, `selectionMode`, `selectionCheckboxes`, `selection` and `plugins`. Other attributes (`aria-label`, `class`, `style`, …) stay on the element. `null`, as from the `async` pipe, means unset.
- **Outputs** `cellClick`, `rowClick`, `rangeChange` and `loadError` emit the element's `CustomEvent`; in `(rowClick)`, `$event.detail.row` has your row type. The outputs of state changes (`sortingChange`, `columnSizingChange`, `columnOrderChange`, `columnPinningChange`, `columnVisibilityChange`, `columnFiltersChange`, `selectionChange`) emit the new value, for two-way binding; bind the element's own event, such as `(argus-column-sizing-change)`, for the whole `CustomEvent`. The details are in the [`argus-table` README](https://www.npmjs.com/package/argus-table).
- **Cells and headers** can be Angular templates: `<ng-template argusCell="<column id>">` and `argusHeader` inside `<argus-table>`, or `argusTemplate()` from a `cell` function. See [Angular templates in cells](#angular-templates-in-cells).
- **Height:** the table virtualizes its rows, so it needs a bounded height. Its default is 400 px.

## Angular templates in cells

Give a column its cells or header with a template inside the table, named by column id:

```ts
@Component({
  imports: [ARGUS_TABLE, StatusBadge],
  template: `
    <argus-table [columns]="columns" [data]="orders()">
      <ng-template argusCell="status" [argusCellOf]="orders()" let-row let-value="value">
        <app-status-badge [status]="value" [order]="row.id" />
      </ng-template>
      <ng-template argusHeader="total" let-column>Total <app-info-tip [topic]="column" /></ng-template>
    </argus-table>
  `,
})
```

- `argusCell` templates get the row as `let-row` and `value`, `rowId`, `index`, `columnId` and `pinned` from the context. With `[argusCellOf]="rows"`, `row` has your row type in strict templates. `argusHeader` templates get the column id.
- They work for `[columns]` arrays and `<argus-column>` children alike, and a template that goes away (`@if`) gives the column back its own content.
- From a `cell` function, return `argusTemplate(templateRef, context)`: `cell: (row) => argusTemplate(this.badge, { $implicit: row })`.
- The views keep your component's bindings and DI. Hold the state they read in signals (as zoneless apps do), so changes reach the cells.
- Cells are pooled: as the table scrolls, a cell shows another row and its view **gets a new context instead of being re-created**. Keep per-row state in your data (or keyed by `rowId`), not in a cell component's own fields.
- Template content renders before the browser paints and before `width: 'auto'` measures. The templates reach the columns as the table's first plugin, so `headerMenu()` and `formulas()` wrap templated headers as usual.
- `ARGUS_TABLE` holds the table and column components and both directives, for `imports`.

## Two-way binding

`[(sorting)]`, `[(columnSizing)]`, `[(columnOrder)]`, `[(columnPinning)]`, `[(columnVisibility)]`, `[(columnFilters)]` and `[(selection)]` keep a value in sync with the table; their outputs (`sortingChange` and so on) emit the new value. Leave one unbound and the table keeps that state itself. A one-way `[sorting]` is controlled: a header click only emits the proposed order, and nothing changes until you set it. To save column widths once a resize is done, rather than on every frame of a drag, use `(columnResizeEnd)` (`$event.detail.columnSizing`).

## Formula columns

With `formulas()` from [`@argus-table/formulas`](https://www.npmjs.com/package/@argus-table/formulas) in `plugins`, the formula editor proposes column changes through the `formulaColumnAdd`, `formulaColumnChange` and `formulaColumnRemove` outputs. The table doesn't change its columns: apply `$event.detail.columns`, which holds your columns, templates included.

```ts
@Component({
  imports: [ARGUS_TABLE],
  template: `<argus-table
    [columns]="columns()"
    [data]="orders"
    [plugins]="plugins"
    (formulaColumnAdd)="apply($event)"
    (formulaColumnChange)="apply($event)"
    (formulaColumnRemove)="apply($event)"
  />`,
})
export class OrdersTable {
  readonly columns = signal<readonly AngularColumnDef<Order>[]>(initialColumns);
  apply(event: CustomEvent<FormulaColumnDetail<Order>>) {
    this.columns.set(event.detail.columns);
  }
}
```

## Methods

A view query gives the component, with `refresh()`, `scrollToRow(index)`, `autosizeColumns(ids?)`, `getState()` / `setState(state)` (save and restore a user's layout: sorting, widths, order, pinning, hidden columns, filters, selection and scroll position) and the `element`:

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
