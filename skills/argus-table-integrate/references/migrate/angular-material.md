# From Angular Material `mat-table`

Covers `MatTableModule` (`<table mat-table>`), `MatSort`, `MatPaginator`, `MatTableDataSource`, and CDK virtual scroll around tables. The column templates become `argusCell` templates or a `cell` function.

## Detect

`<table mat-table [dataSource]>` or `<mat-table>`, `matColumnDef`, `*matHeaderCellDef` / `*matCellDef`, `displayedColumns`, `MatTableDataSource`, `matSort` / `mat-sort-header`, `<mat-paginator>`.

## Concepts

| Feature id       | Angular Material                                             | argus-table                                             | Fit     | Notes                                                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| `sort`           | `matSort`, `mat-sort-header`, `MatSort`                      | `sortable: true`, `[(sorting)]`                         | maps    | `sortingDataAccessor` → the column's `accessor`              |
| `paginator`      | `<mat-paginator>`                                            | none: the table scrolls                                 | gap     | [gaps.md](../gaps.md#pagination)                             |
| `filter`         | `dataSource.filter`, `filterPredicate`                       | `quickFilter`, or `filterFn` per column                 | maps    |                                                              |
| `selection`      | `SelectionModel` + `mat-checkbox` column                     | `selectionMode`, `selectionCheckboxes`, `[(selection)]` | maps    | Delete the checkbox column and the `SelectionModel`          |
| `sticky`         | `sticky` / `stickyEnd` on `matColumnDef`, sticky header rows | `pin: 'start' / 'end'`; the header is always sticky     | maps    |                                                              |
| `cell-templates` | `*matCellDef="let row"`, `*matHeaderCellDef`                 | `<ng-template argusCell="id" let-row>`, `argusHeader`   | maps    | Plain text cells need no template: `accessor` is enough      |
| `footer`         | `matFooterCellDef`, `matFooterRowDef`                        | `pinnedRows.bottom`                                     | partial | A totals row object                                          |
| `expandable`     | `multiTemplateDataRows`, detail rows                         | none                                                    | gap     | [gaps.md](../gaps.md#master-detail)                          |
| `cdk-virtual`    | `cdk-virtual-scroll-viewport` around a table                 | built in                                                | builtin | Delete the viewport                                          |
| `drag`           | `cdkDropList` on header cells                                | header drag is built in; `[(columnOrder)]`              | partial | Row drag-and-drop is a gap ([row-drag](../gaps.md#row-drag)) |
| `row-click`      | `(click)` on `<tr mat-row>`                                  | `(rowClick)` (`$event.detail.row`)                      | maps    | Also fires on Enter                                          |

## Columns

Each `matColumnDef` becomes a `ColumnDef` in the component class, and `displayedColumns` is its order:

```html
<!-- Before -->
<ng-container matColumnDef="total">
  <th mat-header-cell *matHeaderCellDef mat-sort-header>Total</th>
  <td mat-cell *matCellDef="let row">{{ row.total | currency }}</td>
</ng-container>
```

```ts
// After: in the component
readonly columns: ColumnDef<Order>[] = [
  { id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true, cell: (o) => this.money.format(o.total) },
];
```

Keep a template when the cell has Angular components, pipes with DI or bindings:

```html
<ng-template argusCell="status" [argusCellOf]="orders()" let-row>
  <app-status-chip [status]="row.status" />
</ng-template>
```

`displayedColumns` that change at runtime → `[(columnVisibility)]` (hiding) or `[(columnOrder)]`.

## State and events

- `MatTableDataSource` with `.sort`, `.paginator`, `.filter` → plain `[data]="orders()"`, `[(sorting)]`, `[quickFilter]="search()"`; the table sorts and filters itself.
- A server-side `DataSource` (connect/disconnect) with paginator and sort events → a `dataSource` with `getRows` ([server-data.md](../server-data.md)).
- `(matSortChange)` → `(sortingChange)` (emits the `SortState`).
- `selection.selected` → `selection()` mapped to rows.

## Example

```ts
@Component({
  selector: 'app-orders',
  imports: [ARGUS_TABLE, CurrencyPipe],
  template: `
    <input #q (input)="search.set(q.value)" aria-label="Filter orders" />
    <argus-table
      aria-label="Orders"
      style="height: 520px"
      [columns]="columns"
      [data]="orders()"
      [getRowId]="getRowId"
      [quickFilter]="search()"
      [(sorting)]="sorting"
      (rowClick)="open($event.detail.row)"
    >
      <ng-template argusCell="total" [argusCellOf]="orders()" let-row>{{
        row.total | currency
      }}</ng-template>
    </argus-table>
  `,
})
export class OrdersComponent {
  readonly orders = input.required<Order[]>();
  readonly search = signal('');
  readonly sorting = signal<SortState>([]);
  readonly getRowId = (o: Order) => o.id;
  readonly columns: ColumnDef<Order>[] = [
    { id: 'id', header: 'Order', accessor: 'id', pin: 'start', width: 110, sortable: true },
    {
      id: 'customer',
      header: 'Customer',
      accessor: 'customer',
      width: { flex: 1 },
      sortable: true,
    },
    { id: 'total', header: 'Total', accessor: 'total', align: 'end', sortable: true },
  ];
  open(order: Order) {}
}
```

## Gaps

The paginator (the table scrolls), expandable detail rows, row drag-and-drop. See [gaps.md](../gaps.md).

## Remove

`MatTableModule`, `MatSortModule`, `MatPaginatorModule` from the component's imports (keep `@angular/material` for the rest of the app), `MatTableDataSource`, `SelectionModel`, `ScrollingModule` when only the table used them, and table CSS (`.mat-mdc-table`, `mat-elevation-z8` on the table).

## Behaviour differences

- The `material` theme is close to Material's look. Angular Material's own theme (`mat.theme`) isn't read: map its colours to tokens if needed.
- Columns can be resized and reordered by users (turn off with `resizable: false`, `reorderable: false`).
- The whole list scrolls instead of paging; the header stays in place.
