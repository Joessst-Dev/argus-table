import { afterEach, describe, expect, test } from 'vitest';
import { Component, ViewChild, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ArgusColumnComponent,
  ArgusTableComponent,
  type ArgusColumnElement,
  type ArgusTableElement,
  type CellClickDetail,
  type ColumnDef,
  type SortChangeDetail,
  type SortState,
} from './index.js';
import { columns, orders, type Order } from './test/data.js';

const SIZE = 'inline-size: 600px; block-size: 400px';

afterEach(() => {
  TestBed.resetTestingModule();
});

/** Renders a host component and waits for the table inside to render. */
async function mount<C>(host: Type<C>) {
  const fixture = TestBed.createComponent(host);
  // Bindings now, as in an app, where a view's nodes and bindings come in one
  // pass; zoneless TestBed would apply them after the elements' first update.
  fixture.detectChanges();
  await fixture.whenStable();
  const el = (fixture.nativeElement as HTMLElement).querySelector<ArgusTableElement>('argus-table');
  if (!el) throw new Error('no <argus-table>');
  await settle(fixture, el);
  return { fixture, el, host: fixture.componentInstance };
}

/** Angular's change detection, the update, two frames, and the follow-up update. */
async function settle(fixture: ComponentFixture<unknown>, el: ArgusTableElement) {
  await fixture.whenStable();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
  await fixture.whenStable();
}

const shadow = (el: HTMLElement) => {
  if (!el.shadowRoot) throw new Error('no shadow root');
  return el.shadowRoot;
};

const headers = (el: ArgusTableElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]'),
];

const headerText = (el: ArgusTableElement) =>
  headers(el).map((h) => h.querySelector('slot')?.assignedElements()[0]?.textContent ?? '');

const firstCell = (el: ArgusTableElement) => {
  const cell = shadow(el).querySelector<HTMLElement>('[part~="row"] [part~="cell"]');
  if (!cell) throw new Error('no body cell');
  return cell;
};

describe('<argus-table> component', () => {
  test('sets its inputs as element properties; other attributes stay on the element', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        aria-label="Orders"
        class="orders"
        [style]="size"
        [columns]="columns"
        [data]="orders"
        density="compact"
        overscan="3"
        [getRowId]="getRowId"
        [pinnedRows]="pinned"
      />`,
    })
    class Host {
      size = SIZE;
      columns = columns;
      orders = orders;
      getRowId = (o: Order) => o.id;
      pinned = { bottom: [{ id: 'sum', customer: 'Total', total: 1 }] };
    }

    const { el, host } = await mount(Host);
    expect(el.columns).toBe(columns);
    expect(el.data).toBe(orders);
    expect(el.density).toBe('compact');
    expect(el.getAttribute('density')).toBe('compact');
    // A static attribute is read by the element's converter, as in HTML.
    expect(el.overscan).toBe(3);
    expect(el.getRowId).toBe(host.getRowId);
    expect(el.pinnedRows?.bottom).toHaveLength(1);
    expect(el.getAttribute('aria-label')).toBe('Orders');
    expect(el.classList.contains('orders')).toBe(true);
    expect(el.style.inlineSize).toBe('600px');
    expect(headerText(el)).toEqual(['Order', 'Customer', 'Total']);
  });

  test('emits the element events as outputs', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        [style]="size"
        [columns]="columns"
        [data]="orders"
        (cellClick)="cells.push($event)"
        (rowClick)="rows = rows + 1"
        (sortChange)="sorts.push($event)"
      />`,
    })
    class Host {
      size = SIZE;
      columns = columns;
      orders = orders;
      cells: CustomEvent<CellClickDetail<Order>>[] = [];
      rows = 0;
      sorts: CustomEvent<SortChangeDetail>[] = [];
    }

    const { el, host, fixture } = await mount(Host);
    firstCell(el).click();
    expect(host.cells).toHaveLength(1);
    expect(host.cells[0]).toBeInstanceOf(CustomEvent);
    expect(host.cells[0]?.detail.row).toBe(orders[0]);
    expect(host.rows).toBe(1);

    headers(el)[2]?.click();
    await settle(fixture, el);
    expect(host.sorts.map((e) => e.detail.sorting)).toEqual([[{ id: 'total', desc: false }]]);
  });

  test('ignores the events of a table nested in a cell', async () => {
    const nested = document.createElement('argus-table');
    nested.columns = [{ id: 'x', header: 'X', accessor: () => 'inner' }];
    nested.data = [{}];
    nested.style.cssText = 'inline-size: 200px; block-size: 100px';

    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        [style]="size"
        [columns]="columns"
        [data]="orders"
        (rowClick)="rows = rows + 1"
      />`,
    })
    class Host {
      size = SIZE;
      columns: ColumnDef<Order>[] = [
        { id: 'inner', header: 'Inner', cell: () => nested, width: 220 },
      ];
      orders = orders.slice(0, 1);
      rows = 0;
    }

    const { el, host } = await mount(Host);
    await nested.updateComplete;
    await new Promise(requestAnimationFrame);
    await nested.updateComplete;
    expect(el.contains(nested)).toBe(true);

    const innerCell = nested.shadowRoot?.querySelector<HTMLElement>('[part~="row"] [part~="cell"]');
    innerCell?.click();
    // The inner click bubbles to the outer table, which fires its own row click once.
    expect(host.rows).toBe(1);
  });

  test('leaves sorting uncontrolled when it is not bound, and still emits sortingChange', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        [style]="size"
        [columns]="columns"
        [data]="orders"
        (sortingChange)="seen.push($event)"
      />`,
    })
    class Host {
      size = SIZE;
      columns = columns;
      orders = orders;
      seen: SortState[] = [];
    }

    const { el, host, fixture } = await mount(Host);
    headers(el)[2]?.click();
    await settle(fixture, el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
    expect(host.seen).toEqual([[{ id: 'total', desc: false }]]);
  });

  test('keeps a one-way [sorting] controlled', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        [style]="size"
        [columns]="columns"
        [data]="orders"
        [sorting]="sorting"
        (sortingChange)="seen.push($event)"
      />`,
    })
    class Host {
      size = SIZE;
      columns = columns;
      orders = orders;
      sorting: SortState = [];
      seen: SortState[] = [];
    }

    const { el, host, fixture } = await mount(Host);
    headers(el)[2]?.click();
    await settle(fixture, el);
    expect(host.seen).toEqual([[{ id: 'total', desc: false }]]);
    expect(el.sorting).toEqual([]);
  });

  test('binds sorting, columnSizing and columnOrder two-way', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        [style]="size"
        [columns]="columns"
        [data]="orders"
        [(sorting)]="sorting"
        [(columnSizing)]="sizing"
        [(columnOrder)]="order"
      />`,
    })
    class Host {
      size = SIZE;
      columns = columns;
      orders = orders;
      sorting = signal<SortState>([]);
      sizing = signal<Record<string, number>>({});
      order = signal<string[]>([]);
    }

    const { el, host, fixture } = await mount(Host);

    headers(el)[2]?.click();
    await settle(fixture, el);
    expect(host.sorting()).toEqual([{ id: 'total', desc: false }]);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
    expect(headers(el)[2]?.getAttribute('aria-sort')).toBe('ascending');

    await el.autosizeColumns(['id']);
    await settle(fixture, el);
    expect(Object.keys(host.sizing())).toEqual(['id']);
    expect(el.columnSizing).toEqual(host.sizing());

    headers(el)[0]?.focus();
    headers(el)[0]?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    await settle(fixture, el);
    expect(host.order()).toEqual(['customer', 'id', 'total']);
    expect(headerText(el)).toEqual(['Customer', 'Order', 'Total']);
  });

  test('null (the async pipe) and undefined fall back to the element defaults', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table
        [style]="size"
        [columns]="columns()"
        [data]="rows()"
        [overscan]="overscan()"
        [sorting]="sorting()"
      />`,
    })
    class Host {
      size = SIZE;
      columns = signal<ColumnDef<Order>[] | null>(null);
      rows = signal<Order[] | null>(null);
      overscan = signal<number | undefined>(2);
      sorting = signal<SortState | undefined>([]);
    }

    const { el, host, fixture } = await mount(Host);
    expect(el.columns).toEqual([]);
    expect(el.data).toEqual([]);
    expect(el.overscan).toBe(2);

    host.columns.set(columns);
    host.rows.set(orders);
    host.overscan.set(undefined);
    host.sorting.set(undefined);
    await settle(fixture, el);
    expect(el.overscan).toBe(6);
    expect(headerText(el)).toEqual(['Order', 'Customer', 'Total']);

    // `sorting` handed back: a click sorts by itself.
    headers(el)[2]?.click();
    await settle(fixture, el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
  });

  test('gives the element and its methods through a view query', async () => {
    @Component({
      imports: [ArgusTableComponent],
      template: `<argus-table [style]="size" [columns]="columns" [data]="orders" />`,
    })
    class Host {
      size = SIZE;
      columns = columns;
      orders = orders;
      // A decorator query: signal queries need the CLI's JIT transform, which tests don't run.
      @ViewChild(ArgusTableComponent) table?: ArgusTableComponent<Order>;
    }

    const { el, host } = await mount(Host);
    expect(host.table?.element).toBe(el);
    await expect(host.table?.refresh()).resolves.toBeUndefined();
    await expect(host.table?.scrollToRow(10)).resolves.toBeUndefined();
  });
});

describe('<argus-column> component', () => {
  test('reads static attributes as the element does in HTML', async () => {
    @Component({
      imports: [ArgusTableComponent, ArgusColumnComponent],
      template: `<argus-table [style]="size" [data]="orders">
        <argus-column
          column-id="id"
          header="Order"
          accessor="id"
          width="90"
          min-width="50"
          pin="start"
        />
        <argus-column columnId="customer" header="Customer" accessor="customer" width="2fr" />
        <argus-column
          column-id="total"
          header="Total"
          accessor="total"
          width="auto"
          sortable
          resizable="false"
        />
        <argus-column
          [columnId]="'calc'"
          [header]="'Calc'"
          [accessor]="double"
          [width]="120"
          [sortable]="true"
        />
      </argus-table>`,
    })
    class Host {
      size = SIZE;
      orders = orders;
      double = (o: Order) => o.total * 2;
    }

    const { el } = await mount(Host);
    const cols = [...el.querySelectorAll<ArgusColumnElement>('argus-column')];
    expect(cols.map((c) => c.columnId)).toEqual(['id', 'customer', 'total', 'calc']);
    expect(cols.map((c) => c.width)).toEqual([90, { flex: 2 }, 'auto', 120]);
    expect(cols[0]?.minWidth).toBe(50);
    expect(cols.map((c) => c.sortable)).toEqual([undefined, undefined, true, true]);
    expect(cols[2]?.resizable).toBe(false);
    expect(headerText(el)).toEqual(['Order', 'Customer', 'Total', 'Calc']);
  });

  test('follows the columns @for adds, removes and moves', async () => {
    @Component({
      imports: [ArgusTableComponent, ArgusColumnComponent],
      template: `<argus-table [style]="size" [data]="orders">
        @for (id of ids(); track id) {
          <argus-column [columnId]="id" [header]="id.toUpperCase()" [accessor]="id" />
        }
      </argus-table>`,
    })
    class Host {
      size = SIZE;
      orders = orders;
      ids = signal(['id', 'customer']);
    }

    const { el, host, fixture } = await mount(Host);
    expect(headerText(el)).toEqual(['ID', 'CUSTOMER']);

    host.ids.set(['id', 'customer', 'total']);
    await settle(fixture, el);
    expect(headerText(el)).toEqual(['ID', 'CUSTOMER', 'TOTAL']);

    host.ids.set(['total', 'id', 'customer']);
    await settle(fixture, el);
    expect(headerText(el)).toEqual(['TOTAL', 'ID', 'CUSTOMER']);

    host.ids.set(['total', 'customer']);
    await settle(fixture, el);
    expect(headerText(el)).toEqual(['TOTAL', 'CUSTOMER']);

    // Angular's children and the table's own light-DOM content stay apart.
    expect(el.querySelectorAll(':scope > argus-column')).toHaveLength(2);
    expect(el.querySelectorAll(':scope > [slot]').length).toBeGreaterThan(0);
  });
});
