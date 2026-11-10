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
import {
  ARGUS_TABLE,
  argusTemplate,
  type AngularColumnDef,
  type ArgusCellContext,
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
    <argus-table style="${SIZE}" [columns]="columns" [data]="rows()">
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
}

describe('Angular templates in cells and headers', () => {
  test('renders argusCell and argusHeader templates, with the host’s state and DI', async () => {
    const { el, fixture, host } = await mount(Templates);
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
