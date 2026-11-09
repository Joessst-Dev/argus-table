import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive, ref, type App, type Component } from 'vue';
import {
  ArgusTable,
  type ArgusTableElement,
  type ArgusTableExposed,
  type ColumnDef,
  type SortState,
} from './index.js';
import { columns, orders, size, type Order } from './test/data.js';
import Declarative from './test/Declarative.vue';

let app: App | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  app?.unmount();
  container?.remove();
  app = undefined;
  container = undefined;
});

/** Mounts a component and waits for the table inside to render. */
async function mount(component: Component, props?: Record<string, unknown>) {
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(component, props);
  const instance = app.mount(container);
  const el = container.querySelector<ArgusTableElement>('argus-table');
  if (!el) throw new Error('no <argus-table>');
  await settle(el);
  return { el, instance };
}

/** Vue's flush, the update, two frames (resize observers, virtualizer), and the follow-up update. */
async function settle(el: ArgusTableElement) {
  await nextTick();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
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

describe('<ArgusTable>', () => {
  test('sets its props as element properties and passes attributes through', async () => {
    const getRowId = (o: Order) => o.id;
    const { el } = await mount(() =>
      h(ArgusTable<Order>, {
        'aria-label': 'Orders',
        class: 'orders',
        style: size,
        columns,
        data: orders,
        density: 'compact',
        overscan: 3,
        getRowId,
        pinnedRows: { bottom: [{ id: 'sum', customer: 'Total', total: 1 }] },
      }),
    );

    expect(el.columns).toBe(columns);
    expect(el.data).toBe(orders);
    expect(el.density).toBe('compact');
    expect(el.getAttribute('density')).toBe('compact');
    expect(el.overscan).toBe(3);
    expect(el.getRowId).toBe(getRowId);
    expect(el.pinnedRows?.bottom).toHaveLength(1);
    expect(el.getAttribute('aria-label')).toBe('Orders');
    expect(el.classList.contains('orders')).toBe(true);
    expect(el.style.inlineSize).toBe('600px');
    expect(headerText(el)).toEqual(['Order', 'Customer', 'Total']);
  });

  test('emits the element events', async () => {
    const onCellClick = vi.fn();
    const onRowClick = vi.fn();
    const onSortChange = vi.fn();
    const { el } = await mount(() =>
      h(ArgusTable<Order>, {
        style: size,
        columns,
        data: orders,
        onCellClick,
        onRowClick,
        'onSort-change': onSortChange,
      }),
    );

    firstCell(el).click();
    expect(onCellClick).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledOnce();
    const cellEvent = onCellClick.mock.calls[0]?.[0] as CustomEvent<{ row: Order }>;
    expect(cellEvent).toBeInstanceOf(CustomEvent);
    expect(cellEvent.detail.row).toBe(orders[0]);

    headers(el)[2]?.click();
    await settle(el);
    expect(onSortChange).toHaveBeenCalledOnce();
    expect(onSortChange.mock.calls[0]?.[0]).toMatchObject({
      detail: { sorting: [{ id: 'total', desc: false }] },
    });
  });

  test('ignores the events of a table nested in a cell', async () => {
    const nested = document.createElement('argus-table');
    nested.columns = [{ id: 'x', header: 'X', accessor: () => 'inner' }];
    nested.data = [{}];
    nested.style.cssText = 'inline-size: 200px; block-size: 100px';
    const outer: ColumnDef<Order>[] = [
      { id: 'inner', header: 'Inner', cell: () => nested, width: 220 },
    ];
    const onRowClick = vi.fn();
    const { el } = await mount(() =>
      h(ArgusTable<Order>, { style: size, columns: outer, data: orders.slice(0, 1), onRowClick }),
    );
    await settle(nested);
    expect(el.contains(nested)).toBe(true);

    firstCell(nested).click();
    // The click reaches the outer table, which fires its own row click once.
    expect(onRowClick).toHaveBeenCalledOnce();
    expect((onRowClick.mock.calls[0]?.[0] as Event).target).toBe(el);
  });

  test('leaves sorting uncontrolled when it is not bound, and still emits update:sorting', async () => {
    const update = vi.fn();
    const { el } = await mount(() =>
      h(ArgusTable<Order>, { style: size, columns, data: orders, 'onUpdate:sorting': update }),
    );
    headers(el)[2]?.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
    expect(update).toHaveBeenCalledWith([{ id: 'total', desc: false }]);
  });

  test('keeps a one-way :sorting controlled', async () => {
    const update = vi.fn();
    const { el } = await mount(() =>
      h(ArgusTable<Order>, {
        style: size,
        columns,
        data: orders,
        sorting: [],
        'onUpdate:sorting': update,
      }),
    );
    headers(el)[2]?.click();
    await settle(el);
    expect(update).toHaveBeenCalledWith([{ id: 'total', desc: false }]);
    expect(el.sorting).toEqual([]);
  });

  test('binds columnSizing, columnOrder and selection two-way', async () => {
    const state = reactive<{ sizing: Record<string, number>; order: string[]; selected: string[] }>(
      { sizing: {}, order: [], selected: [] },
    );
    const { el } = await mount(() =>
      h(ArgusTable<Order>, {
        style: size,
        columns,
        data: orders,
        columnSizing: state.sizing,
        'onUpdate:columnSizing': (v: Record<string, number>) => {
          state.sizing = v;
        },
        columnOrder: state.order,
        'onUpdate:columnOrder': (v: string[]) => {
          state.order = v;
        },
        selectionMode: 'multi',
        selection: state.selected,
        'onUpdate:selection': (v: string[]) => {
          state.selected = v;
        },
      }),
    );

    await el.autosizeColumns(['id']);
    await settle(el);
    expect(Object.keys(state.sizing)).toEqual(['id']);
    expect(el.columnSizing).toEqual(state.sizing);

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
    await settle(el);
    expect(state.order).toEqual(['customer', 'id', 'total']);
    expect(headerText(el)).toEqual(['Customer', 'Order', 'Total']);

    const cell = el.shadowRoot?.querySelector<HTMLElement>(
      '[role="row"][aria-rowindex="3"] > [role="gridcell"]',
    );
    cell?.click();
    await settle(el);
    expect(state.selected).toEqual(['1']);
    expect(el.selection).toEqual(['1']);
    expect(cell?.parentElement?.getAttribute('aria-selected')).toBe('true');
  });

  test('sets undefined when a prop goes away, so the element falls back to its defaults', async () => {
    const state = reactive({ bound: true });
    const { el } = await mount(() =>
      h(
        ArgusTable<Order>,
        state.bound
          ? { style: size, columns, data: orders, overscan: 2, sorting: [] }
          : { style: size },
      ),
    );
    expect(el.overscan).toBe(2);

    state.bound = false;
    await settle(el);
    expect(el.columns).toEqual([]);
    expect(el.data).toEqual([]);
    // Not 0, as Vue's own DOM prop patching would set.
    expect(el.overscan).toBe(6);

    // Uncontrolled again: a click sorts by itself.
    state.bound = true;
    await settle(el);
    el.sorting = undefined;
    await settle(el);
    headers(el)[2]?.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
  });

  test('exposes the element and its methods to a template ref', async () => {
    const table = ref<ArgusTableExposed<Order>>();
    const { el } = await mount(() =>
      h(ArgusTable<Order>, { ref: table, style: size, columns, data: orders }),
    );
    expect(table.value?.element).toBe(el);
    await expect(table.value?.refresh()).resolves.toBeUndefined();
    await expect(table.value?.scrollToRow(10)).resolves.toBeUndefined();
  });
});

describe('templates', () => {
  test('v-model:sorting, @row-click, boolean attributes and a template ref', async () => {
    const ids = ref(['id', 'customer', 'total']);
    const { el, instance } = await mount(Declarative, { ids: ids.value });
    const vm = instance as unknown as {
      sorting: SortState;
      clicked: Order[];
      refresh(): Promise<void>;
    };

    expect(headerText(el)).toEqual(['ID', 'CUSTOMER', 'TOTAL', 'Flag']);
    expect(el.getAttribute('aria-label')).toBe('Orders');

    // `sortable` with no value is true, not ''; an unbound `:sortable` stays unset.
    const flags = [...el.querySelectorAll<HTMLElement & { sortable?: boolean }>('argus-column')];
    expect(flags.map((c) => c.sortable)).toEqual([undefined, undefined, true, true]);

    headers(el)[2]?.click();
    await settle(el);
    expect(vm.sorting).toEqual([{ id: 'total', desc: false }]);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
    expect(headers(el)[2]?.getAttribute('aria-sort')).toBe('ascending');

    firstCell(el).click();
    expect(vm.clicked).toHaveLength(1);

    await expect(vm.refresh()).resolves.toBeUndefined();
  });

  test('follows <ArgusColumn> children that v-for adds, removes and moves', async () => {
    const ids = ref(['id', 'customer']);
    const { el } = await mount(() => h(Declarative, { ids: ids.value }));

    ids.value = ['id', 'customer', 'total'];
    await settle(el);
    expect(headerText(el)).toEqual(['ID', 'CUSTOMER', 'TOTAL', 'Flag']);

    ids.value = ['total', 'id', 'customer'];
    await settle(el);
    expect(headerText(el)).toEqual(['TOTAL', 'ID', 'CUSTOMER', 'Flag']);

    ids.value = ['total', 'customer'];
    await settle(el);
    expect(headerText(el)).toEqual(['TOTAL', 'CUSTOMER', 'Flag']);

    // Vue's children and the table's own light-DOM content stay apart.
    expect(el.querySelectorAll(':scope > [slot]').length).toBeGreaterThan(0);
    app?.unmount();
    app = undefined;
    expect(container?.childElementCount).toBe(0);
  });
});
