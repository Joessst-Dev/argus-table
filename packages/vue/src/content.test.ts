import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cellEditing, type CellEditDetail } from '@argus-table/editing';
import { createApp, defineComponent, h, nextTick, provide, reactive, type App } from 'vue';
import {
  ArgusTable,
  type ArgusPlugin,
  type ArgusTableElement,
  type VueColumnDef,
} from './index.js';
import Groups from './test/Groups.vue';
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

  test("a slotted header names its column by the definition's header", async () => {
    const names: (string | undefined)[] = [];
    const plugins: ArgusPlugin<Order>[] = [
      {
        name: 'names',
        columns: (defs, host) => {
          names.splice(0, Infinity, ...defs.map((d) => host.headerText(d)));
          return undefined;
        },
      },
    ];
    await mount(() =>
      createApp(() => h(Slots, { rows: orders(2), currency: 'EUR', showTotal: true, plugins })),
    );
    expect(names).toEqual(['Order', 'Customer', 'Total']);
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

  test('renders #group-<id> slots, from column-groups and <ArgusColumnGroup>', async () => {
    const group = (el: ArgusTableElement) =>
      el.shadowRoot
        ?.querySelector<HTMLSlotElement>('[part~="header-group-cell"] slot')
        ?.assignedElements()[0]
        ?.textContent.trim();
    for (const declarative of [false, true]) {
      const state = reactive({ currency: 'EUR' });
      const el = await mount(() =>
        createApp(() => h(Groups, { rows: orders(2), declarative, ...state })),
      );
      expect(group(el)).toBe('money in EUR');
      state.currency = 'CHF';
      await settle(el);
      expect(group(el)).toBe('money in CHF');
      app?.unmount();
      container?.remove();
    }
    app = undefined;
    container = undefined;
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

describe('Vue content in pinned rows and custom editors', () => {
  const pinnedCell = (el: ArgusTableElement, columnId: string) =>
    el.shadowRoot
      ?.querySelector<HTMLSlotElement>(`[part~="row-pinned-bottom"] [data-col="${columnId}"] slot`)
      ?.assignedElements()[0];

  test('a #cell-<id> slot gets `pinned` for a pinned row', async () => {
    const columns: VueColumnDef<Order>[] = [{ id: 'customer', accessor: 'customer', width: 200 }];
    const el = await mount(() =>
      createApp(() =>
        h(
          ArgusTable<Order>,
          {
            style: size,
            columns,
            data: orders(3),
            pinnedRows: { bottom: [{ id: 'sum', customer: 'Total', total: 0 }] },
          },
          {
            'cell-customer': ({ row, pinned }: { row: Order; pinned?: string }) =>
              h('b', { 'data-pinned': pinned ?? 'body' }, row.customer),
          },
        ),
      ),
    );
    expect(pinnedCell(el, 'customer')?.querySelector('b')?.getAttribute('data-pinned')).toBe(
      'bottom',
    );
  });

  test('a custom editor renders a VNode in the cell, takes focus and commits', async () => {
    const edited: unknown[] = [];
    const columns: VueColumnDef<Order>[] = [
      { id: 'id', header: 'Order', accessor: 'id', width: 90 },
      {
        id: 'total',
        header: 'Total',
        accessor: 'total',
        width: 160,
        meta: {
          edit: {
            editor: ({ label, commit }) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'three',
                  'aria-label': label,
                  onClick: () => {
                    commit(3);
                  },
                },
                '3',
              ),
          },
        },
      },
    ];
    const plugins = [cellEditing<Order>()];
    const el = await mount(() =>
      createApp(() =>
        h(ArgusTable<Order>, {
          style: size,
          columns,
          data: orders(3),
          plugins,
          'onCell-edit': (event: CustomEvent<CellEditDetail<Order>>) => {
            edited.push(event.detail.value);
          },
        }),
      ),
    );
    const cell = el.shadowRoot?.querySelector<HTMLElement>(
      '[part~="body"] > [aria-rowindex="2"] > [data-col="total"]',
    );
    cell?.focus();
    cell?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, composed: true }));
    await settle(el);
    const button = el.querySelector<HTMLButtonElement>('button.three');
    expect(button?.getAttribute('aria-label')).toBe('Total, row 1');
    expect(document.activeElement).toBe(button);
    button?.click();
    await settle(el);
    expect(edited).toEqual([3]);
    expect(el.querySelector('button.three')).toBeNull();
  });
});
