import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createApp, defineComponent, h, nextTick, provide, reactive, type App } from 'vue';
import { ArgusTable, type ArgusTableElement, type VueColumnDef } from './index.js';
import Slots from './test/Slots.vue';
import { counts } from './test/counts.js';
import { size, type Order } from './test/data.js';

let app: App | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  counts.mounts = 0;
  counts.unmounts = 0;
});

afterEach(() => {
  app?.unmount();
  container?.remove();
  app = undefined;
  container = undefined;
});

const orders = (count: number): Order[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `o${String(i)}`,
    customer: `Customer ${String(i)}`,
    total: (i * 37) % 100,
  }));

async function mount(make: () => App): Promise<ArgusTableElement> {
  container = document.createElement('div');
  document.body.append(container);
  app = make();
  app.mount(container);
  const el = container.querySelector<ArgusTableElement>('argus-table');
  if (!el) throw new Error('no <argus-table>');
  await settle(el);
  return el;
}

async function settle(el: ArgusTableElement) {
  await nextTick();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

/** Each rendered body row's cell content in a column, in row order. */
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

describe('Vue content in cells and headers', () => {
  test('renders VNodes from cell and header render functions', async () => {
    const columns: VueColumnDef<Order>[] = [
      { id: 'id', header: () => h('i', { class: 'h' }, 'Order'), accessor: 'id', width: 90 },
      { id: 'total', header: 'Total', width: 120, cell: (o) => h('b', `${String(o.total)} €`) },
    ];
    const el = await mount(() =>
      createApp(() => h(ArgusTable<Order>, { style: size, columns, data: orders(3) })),
    );
    expect(cells(el, 'total')).toEqual(['0 €', '37 €', '74 €']);
    expect(header(el, 'id')?.querySelector('i.h')?.textContent).toBe('Order');
    expect(cells(el, 'id')).toEqual(['o0', 'o1', 'o2']);
  });

  test('renders #cell-<id> and #header-<id> slots, following the parent’s state', async () => {
    const state = reactive({ currency: 'EUR', showTotal: true });
    const el = await mount(() => createApp(() => h(Slots, { rows: orders(3), ...state })));
    expect(cells(el, 'total')).toEqual(['0 EUR', '37 EUR', '74 EUR']);
    expect(cells(el, 'customer')).toEqual(['Customer 0', 'Customer 1', 'Customer 2']);
    expect(header(el, 'total')?.querySelector('.slot-header')?.textContent).toBe('total in EUR');

    state.currency = 'CHF';
    await settle(el);
    expect(cells(el, 'total')).toEqual(['0 CHF', '37 CHF', '74 CHF']);
    expect(header(el, 'total')?.textContent.trim()).toBe('total in CHF');

    // A slot that goes away gives the column back its own content.
    state.showTotal = false;
    await settle(el);
    expect(cells(el, 'total')).toEqual(['0', '37', '74']);
  });

  test('pooled cells keep their components while scrolling: no remounts', async () => {
    const el = await mount(() =>
      createApp(() => h(Slots, { rows: orders(10_000), currency: 'EUR', showTotal: true })),
    );
    const mounted = counts.mounts;
    expect(mounted).toBeGreaterThan(5);
    await el.scrollToRow(5000);
    await settle(el);
    expect(cells(el, 'customer')).toContain('Customer 5000');
    expect(counts.mounts).toBe(mounted);
    expect(counts.unmounts).toBe(0);
  });

  test('unmounts cell components whose cells go away, and all of them with the app', async () => {
    const state = reactive({ rows: orders(5) });
    const el = await mount(() =>
      createApp(() => h(Slots, { rows: state.rows, currency: '', showTotal: true })),
    );
    expect(counts.mounts).toBe(5);
    state.rows = orders(2);
    await settle(el);
    expect(counts.unmounts).toBe(3);
    app?.unmount();
    app = undefined;
    expect(counts.unmounts).toBe(5);
  });

  test('cells see what the app and the table’s ancestors provide', async () => {
    const Provider = defineComponent({
      setup() {
        provide('theme', '/dark');
        return () => h(Slots, { rows: orders(1), currency: '', showTotal: true });
      },
    });
    const el = await mount(() => createApp(Provider).provide('unit', ' kg'));
    expect(cells(el, 'customer')).toEqual(['Customer 0 kg/dark']);
  });

  test('slots work with <ArgusColumn> children too', async () => {
    const el = await mount(() =>
      createApp(() =>
        h(Slots, { rows: orders(2), currency: '', showTotal: true, declarative: true }),
      ),
    );
    expect(cells(el, 'customer')).toEqual(['Customer 0', 'Customer 1']);
    expect(el.querySelector('.badge')).not.toBeNull();
  });

  test('auto width measures slot content', async () => {
    const columns: VueColumnDef<Order>[] = [
      { id: 'c', header: 'C', width: 'auto', cell: (o) => h('span', `${o.customer} `.repeat(8)) },
    ];
    const el = await mount(() =>
      createApp(() => h(ArgusTable<Order>, { style: size, columns, data: orders(3) })),
    );
    const width = el.shadowRoot
      ?.querySelector('[role="columnheader"][data-col="c"]')
      ?.getBoundingClientRect().width;
    expect(width).toBeGreaterThan(400);
  });
});
