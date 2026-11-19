import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  Component,
  Injectable,
  Input,
  TemplateRef,
  ViewChild,
  inject,
  signal,
  type OnDestroy,
  type OnInit,
  type Type,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { cellEditing, type EditorContext } from '@argus-table/editing';
import {
  ARGUS_TABLE,
  argusTemplate,
  type AngularColumnDef,
  type ArgusCellContext,
  type ArgusPlugin,
  type ArgusTableElement,
} from './index.js';

interface Order {
  id: string;
  customer: string;
  total: number;
}

const orders = (count: number): Order[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `o${String(i)}`,
    customer: `Customer ${String(i)}`,
    total: (i * 37) % 100,
  }));

const SIZE = 'inline-size: 600px; block-size: 400px';
const counts = { inits: 0, destroys: 0 };

beforeEach(() => {
  counts.inits = 0;
  counts.destroys = 0;
});

afterEach(() => {
  TestBed.resetTestingModule();
});

@Injectable()
class Unit {
  readonly value = ' kg';
}

/** A component in a cell: counts its views, and shows a value from DI. */
@Component({
  selector: 'test-badge',
  template: '<b class="badge">{{ label }}{{ unit.value }}</b>',
})
class Badge implements OnInit, OnDestroy {
  @Input() label = '';
  readonly unit = inject(Unit);
  ngOnInit(): void {
    counts.inits++;
  }
  ngOnDestroy(): void {
    counts.destroys++;
  }
}

const columns: AngularColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 220 },
  { id: 'total', header: 'Total', accessor: 'total', width: 160 },
];

async function mount<C>(host: Type<C>) {
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = (fixture.nativeElement as HTMLElement).querySelector<ArgusTableElement>('argus-table');
  if (!el) throw new Error('no <argus-table>');
  await settle(fixture, el);
  return { fixture, el, host: fixture.componentInstance };
}

async function settle(fixture: ComponentFixture<unknown>, el: ArgusTableElement) {
  fixture.detectChanges();
  await fixture.whenStable();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
  await fixture.whenStable();
}

/** Each rendered body row's cell text in a column, in row order. */
const cells = (el: ArgusTableElement, columnId: string) =>
  [...(el.shadowRoot?.querySelectorAll<HTMLElement>('[part~="row"]') ?? [])]
    .sort(
      (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
    )
    .map((row) => row.querySelector<HTMLSlotElement>(`[data-col="${columnId}"] slot`))
    .map((slot) => slot?.assignedElements()[0]?.textContent.trim());

const header = (el: ArgusTableElement, id: string) =>
  el.shadowRoot
    ?.querySelector<HTMLSlotElement>(`[role="columnheader"][data-col="${id}"] slot`)
    ?.assignedElements()[0];

@Component({
  imports: [ARGUS_TABLE, Badge],
  providers: [Unit],
  template: `
    <argus-table style="${SIZE}" [columns]="columns" [data]="rows()" [plugins]="plugins">
      <ng-template argusCell="customer" [argusCellOf]="rows()" let-row>
        <test-badge [label]="row.customer" />
      </ng-template>
      @if (showTotal()) {
        <ng-template argusCell="total" let-value="value">{{ value }} {{ currency() }}</ng-template>
      }
      <ng-template argusHeader="total" let-id>
        <i class="slot-header">{{ id }} in {{ currency() }}</i>
      </ng-template>
    </argus-table>
  `,
})
class Templates {
  readonly rows = signal(orders(3));
  readonly currency = signal('EUR');
  readonly showTotal = signal(true);
  readonly columns = columns;
  /** The names a plugin after the templates reads from the headers it gets. */
  readonly names: (string | undefined)[] = [];
  readonly plugins: ArgusPlugin<Order>[] = [
    {
      name: 'names',
      columns: (defs, host) => {
        this.names.splice(0, Infinity, ...defs.map((d) => host.headerText(d)));
        return undefined;
      },
    },
  ];
}

describe('Angular templates in cells and headers', () => {
  test('renders argusCell and argusHeader templates, with the host’s state and DI', async () => {
    const { el, fixture, host } = await mount(Templates);
    // A template header names its column by the definition's header.
    expect(host.names).toEqual(['Order', 'Customer', 'Total']);
    expect(cells(el, 'customer')).toEqual(['Customer 0 kg', 'Customer 1 kg', 'Customer 2 kg']);
    expect(cells(el, 'total')).toEqual(['0 EUR', '37 EUR', '74 EUR']);
    expect(header(el, 'total')?.querySelector('.slot-header')?.textContent.trim()).toBe(
      'total in EUR',
    );

    host.currency.set('CHF');
    await settle(fixture, el);
    expect(cells(el, 'total')).toEqual(['0 CHF', '37 CHF', '74 CHF']);
    expect(header(el, 'total')?.textContent.trim()).toBe('total in CHF');

    // A template that goes away gives the column back its own content.
    host.showTotal.set(false);
    await settle(fixture, el);
    expect(cells(el, 'total')).toEqual(['0', '37', '74']);
  });

  test('renders argusGroupHeader templates, for columnGroups and <argus-column-group>', async () => {
    @Component({
      imports: [ARGUS_TABLE],
      template: `
        <argus-table style="${SIZE}" [columns]="columns" [columnGroups]="groups" [data]="rows">
          <ng-template argusGroupHeader="money" let-id>
            <i class="slot-group">{{ id }} in {{ currency() }}</i>
          </ng-template>
        </argus-table>
        <argus-table style="${SIZE}" [data]="rows">
          <argus-column columnId="id" accessor="id" />
          <argus-column-group groupId="money">
            <argus-column columnId="total" accessor="total" />
          </argus-column-group>
          <ng-template argusGroupHeader="money" let-id>
            <i class="slot-group">{{ id }} in {{ currency() }}</i>
          </ng-template>
        </argus-table>
      `,
    })
    class Groups {
      readonly rows = orders(2);
      readonly columns = columns;
      readonly groups = [{ id: 'money', columns: ['total'] }];
      readonly currency = signal('EUR');
    }
    const { el, fixture, host } = await mount(Groups);
    const tables = [...(fixture.nativeElement as HTMLElement).querySelectorAll('argus-table')];
    expect(tables).toHaveLength(2);
    const group = (table: ArgusTableElement) =>
      table.shadowRoot
        ?.querySelector<HTMLSlotElement>('[part~="header-group-cell"] slot')
        ?.assignedElements()[0]
        ?.textContent.trim();
    for (const table of tables) await settle(fixture, table);
    expect(tables.map(group)).toEqual(['money in EUR', 'money in EUR']);
    host.currency.set('CHF');
    await settle(fixture, el);
    for (const table of tables) await settle(fixture, table);
    expect(tables.map(group)).toEqual(['money in CHF', 'money in CHF']);
  });

  test('pooled cells keep their views while scrolling: no re-creation', async () => {
    @Component({
      imports: [ARGUS_TABLE, Badge],
      providers: [Unit],
      template: `
        <argus-table style="${SIZE}" [columns]="columns" [data]="rows">
          <ng-template argusCell="customer" let-row
            ><test-badge [label]="row.customer"
          /></ng-template>
        </argus-table>
      `,
    })
    class Long {
      readonly rows = orders(10_000);
      readonly columns = columns;
    }
    const { el, fixture } = await mount(Long);
    const created = counts.inits;
    expect(created).toBeGreaterThan(5);
    await el.scrollToRow(5000);
    await settle(fixture, el);
    expect(cells(el, 'customer')).toContain('Customer 5000 kg');
    expect(counts.inits).toBe(created);
    expect(counts.destroys).toBe(0);
  });

  test('destroys views whose cells go away, and all of them with the component', async () => {
    const { el, fixture, host } = await mount(Templates);
    host.rows.set(orders(5));
    await settle(fixture, el);
    expect(counts.inits).toBe(5);
    host.rows.set(orders(2));
    await settle(fixture, el);
    expect(counts.destroys).toBe(3);
    fixture.destroy();
    expect(counts.destroys).toBe(5);
  });

  test('renders templates a cell function returns with argusTemplate()', async () => {
    @Component({
      imports: [ARGUS_TABLE],
      template: `
        <ng-template #money let-row let-currency="currency">
          <b class="money">{{ row.total }} {{ currency }}</b>
        </ng-template>
        <argus-table style="${SIZE}" [columns]="columns" [data]="rows" />
      `,
    })
    class Functions implements OnInit {
      @ViewChild('money', { static: true }) money!: TemplateRef<
        ArgusCellContext<Order> & { currency: string }
      >;
      readonly rows = orders(2);
      columns: AngularColumnDef<Order>[] = [];
      ngOnInit(): void {
        this.columns = [
          {
            id: 'total',
            width: 160,
            cell: (row, ctx) =>
              argusTemplate(this.money, {
                $implicit: row,
                row,
                value: ctx.value,
                rowId: ctx.rowId,
                index: ctx.index,
                columnId: ctx.columnId,
                currency: '€',
              }),
          },
        ];
      }
    }
    const { el } = await mount(Functions);
    expect(cells(el, 'total')).toEqual(['0 €', '37 €']);
    expect(el.querySelector('b.money')).not.toBeNull();
  });

  test('templates work with <argus-column> children too', async () => {
    @Component({
      imports: [ARGUS_TABLE, Badge],
      providers: [Unit],
      template: `
        <argus-table style="${SIZE}" [data]="rows">
          @for (id of ids; track id) {
            <argus-column [columnId]="id" [accessor]="id" />
          }
          <ng-template argusCell="customer" let-row
            ><test-badge [label]="row.customer"
          /></ng-template>
        </argus-table>
      `,
    })
    class Children {
      readonly rows = orders(2);
      readonly ids = ['id', 'customer'];
    }
    const { el } = await mount(Children);
    expect(cells(el, 'customer')).toEqual(['Customer 0 kg', 'Customer 1 kg']);
  });

  test('auto width measures template content', async () => {
    @Component({
      imports: [ARGUS_TABLE],
      template: `
        <argus-table style="${SIZE}" [columns]="columns" [data]="rows">
          <ng-template argusCell="c" let-row
            ><span>{{ row.customer.repeat(8) }}</span></ng-template
          >
        </argus-table>
      `,
    })
    class Auto {
      readonly rows = orders(3);
      readonly columns: AngularColumnDef<Order>[] = [{ id: 'c', header: 'C', width: 'auto' }];
    }
    const { el } = await mount(Auto);
    const width = el.shadowRoot
      ?.querySelector('[role="columnheader"][data-col="c"]')
      ?.getBoundingClientRect().width;
    expect(width).toBeGreaterThan(400);
  });
});

describe('Angular content in pinned rows and custom editors', () => {
  const pinnedCell = (el: ArgusTableElement, columnId: string) =>
    el.shadowRoot
      ?.querySelector<HTMLSlotElement>(`[part~="row-pinned-bottom"] [data-col="${columnId}"] slot`)
      ?.assignedElements()[0];

  test('an argusCell template gets `pinned` for a pinned row', async () => {
    @Component({
      imports: [ARGUS_TABLE],
      template: `
        <argus-table style="${SIZE}" [columns]="columns" [data]="rows" [pinnedRows]="pinned">
          <ng-template argusCell="customer" [argusCellOf]="rows" let-row let-pinned="pinned">
            <b [attr.data-pinned]="pinned ?? 'body'">{{ row.customer }}</b>
          </ng-template>
        </argus-table>
      `,
    })
    class Pinned {
      readonly rows = orders(3);
      readonly pinned = { bottom: [{ id: 'sum', customer: 'Total', total: 0 }] };
      readonly columns = columns;
    }
    const { el } = await mount(Pinned);
    expect(pinnedCell(el, 'customer')?.querySelector('b')?.getAttribute('data-pinned')).toBe(
      'bottom',
    );
  });

  test('a custom editor renders a template in the cell, takes focus and commits', async () => {
    @Component({
      imports: [ARGUS_TABLE],
      template: `
        <ng-template #three let-label="label" let-commit="commit">
          <button type="button" class="three" [attr.aria-label]="label" (click)="commit(3)">
            3
          </button>
        </ng-template>
        <argus-table
          style="${SIZE}"
          [columns]="columns"
          [data]="rows"
          [plugins]="plugins"
          (cellEdit)="edited.push($event.detail.value)"
        />
      `,
    })
    class Editor implements OnInit {
      @ViewChild('three', { static: true }) three!: TemplateRef<EditorContext<Order>>;
      readonly rows = orders(3);
      readonly plugins = [cellEditing<Order>()];
      readonly edited: unknown[] = [];
      columns: AngularColumnDef<Order>[] = [];
      ngOnInit(): void {
        this.columns = [
          { id: 'id', header: 'Order', accessor: 'id', width: 90 },
          {
            id: 'total',
            header: 'Total',
            accessor: 'total',
            width: 160,
            meta: { edit: { editor: (context) => argusTemplate(this.three, context) } },
          },
        ];
      }
    }
    const { el, fixture, host } = await mount(Editor);
    const cell = el.shadowRoot?.querySelector<HTMLElement>(
      '[part~="body"] > [aria-rowindex="2"] > [data-col="total"]',
    );
    cell?.focus();
    cell?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, composed: true }));
    await settle(fixture, el);
    const button = el.querySelector<HTMLButtonElement>('button.three');
    expect(button?.getAttribute('aria-label')).toBe('Total, row 1');
    expect(document.activeElement).toBe(button);
    button?.click();
    await settle(fixture, el);
    expect(host.edited).toEqual([3]);
    expect(el.querySelector('button.three')).toBeNull();
  });
});

/** A component with state of its own, to see that a panel keeps it. */
@Component({
  selector: 'test-counter',
  template:
    '<button type="button" class="counter" (click)="count.set(count() + 1)">{{ count() }}</button>',
})
class Counter {
  readonly count = signal(0);
}

@Component({
  imports: [ARGUS_TABLE, Counter],
  template: `
    <output class="expanded">{{ expanded().join(',') }}</output>
    <argus-table
      style="${SIZE}"
      [columns]="columns"
      [data]="rows"
      [getRowId]="idOf"
      [(expanded)]="expanded"
    >
      <ng-template argusDetail [argusDetailOf]="rows" let-row>
        <p class="detail">{{ row.customer }}</p>
        <test-counter />
      </ng-template>
    </argus-table>
  `,
})
class Detail {
  readonly rows = orders(300);
  readonly columns = columns;
  readonly idOf = (order: Order) => order.id;
  readonly expanded = signal<readonly string[]>(['o2']);
}

describe('Angular content in detail panels', () => {
  async function scrollBody(
    fixture: ComponentFixture<unknown>,
    el: ArgusTableElement,
    top: number,
  ) {
    const scroller = el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    const scrolled = new Promise((resolve) => {
      scroller.addEventListener('scroll', resolve, { once: true });
    });
    scroller.scrollTop = top;
    await scrolled;
    await settle(fixture, el);
  }

  test('renders the argusDetail template and keeps its state across scrolling', async () => {
    const { fixture, el } = await mount(Detail);
    expect(el.querySelector('p.detail')?.textContent).toBe('Customer 2');
    const counter = () => el.querySelector<HTMLButtonElement>('button.counter');
    counter()?.click();
    counter()?.click();
    await settle(fixture, el);
    expect(counter()?.textContent).toBe('2');
    await scrollBody(fixture, el, 4000);
    await scrollBody(fixture, el, 0);
    expect(counter()?.textContent).toBe('2');
  });

  test('binds expanded two-way', async () => {
    const { fixture, el, host } = await mount(Detail);
    host.expanded.set([]);
    await settle(fixture, el);
    expect(el.querySelector('p.detail')).toBeNull();
    el.shadowRoot?.querySelector<HTMLButtonElement>('[part~="expand-toggle"]')?.click();
    await settle(fixture, el);
    expect(host.expanded()).toEqual(['o0']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('output.expanded')?.textContent,
    ).toBe('o0');
    expect(el.querySelector('p.detail')?.textContent).toBe('Customer 0');
  });
});

interface TreeNode {
  id: string;
  name: string;
  kids?: TreeNode[];
}

@Component({
  imports: [ARGUS_TABLE],
  template: `
    <output class="tree-expanded">{{ treeExpanded().join(',') }}</output>
    <argus-table
      style="${SIZE}"
      [columns]="columns"
      [data]="nodes"
      [getRowId]="idOf"
      [getSubRows]="kidsOf"
      [(treeExpanded)]="treeExpanded"
    >
      <ng-template argusCell="name" [argusCellOf]="nodes" let-row let-depth="depth">
        <span class="name">{{ row.name }} {{ depth }}</span>
      </ng-template>
    </argus-table>
  `,
})
class Tree {
  readonly nodes: TreeNode[] = [
    { id: 'a', name: 'A', kids: [{ id: 'a1', name: 'A1' }] },
    { id: 'b', name: 'B' },
  ];
  readonly columns: AngularColumnDef<TreeNode>[] = [
    { id: 'name', header: 'Name', accessor: 'name' },
  ];
  readonly idOf = (node: TreeNode) => node.id;
  readonly kidsOf = (node: TreeNode) => node.kids;
  readonly treeExpanded = signal<readonly string[]>([]);
}

describe('Angular tree rows', () => {
  test('binds treeExpanded two-way', async () => {
    const { fixture, el, host } = await mount(Tree);
    expect(el.textContent).not.toContain('A1');
    el.shadowRoot?.querySelector<HTMLButtonElement>('[part~="tree-toggle"]')?.click();
    await settle(fixture, el);
    expect(host.treeExpanded()).toEqual(['a']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('output.tree-expanded')?.textContent,
    ).toBe('a');
    expect(el.textContent).toContain('A1');
    // The cell template gets the row's depth.
    expect([...el.querySelectorAll('span.name')].map((s) => s.textContent).sort()).toEqual([
      'A 0',
      'A1 1',
      'B 0',
    ]);
  });
});
