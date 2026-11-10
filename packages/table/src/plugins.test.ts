import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import type { ArgusTable } from './argus-table.js';
import type { ArgusPlugin, ColumnDef, PluginHost } from './index.js';
import {
  fixture,
  people,
  rowText,
  rowsInOrder,
  scrollTo,
  settle,
  shadow,
  slotted,
  type Person,
} from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200, sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, sortable: true },
  { id: 'city', header: 'City', accessor: 'address.city', width: 120 },
];

const headerOf = (el: HTMLElement, id: string) => {
  const h = shadow(el).querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};

const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

/** A plugin that records its lifecycle into `log`. */
function recorder(name: string, log: string[]): ArgusPlugin<Person> {
  return {
    name,
    connect() {
      log.push(`connect ${name}`);
      return () => log.push(`cleanup ${name}`);
    },
  };
}

/** A plugin that hands its host to the test. */
function hostGrabber(): { plugin: ArgusPlugin<Person>; host: () => PluginHost<Person> } {
  let host: PluginHost<Person> | undefined;
  return {
    plugin: {
      name: 'grab',
      connect(h) {
        host = h;
      },
    },
    host: () => {
      if (!host) throw new Error('not connected');
      return host;
    },
  };
}

describe('plugin lifecycle', () => {
  test('connects in array order and cleans up in reverse when removed', async () => {
    const log: string[] = [];
    const a = recorder('a', log);
    const b = recorder('b', log);
    const el = await fixture({ columns, data: people(3), plugins: [a, b] });
    expect(log).toEqual(['connect a', 'connect b']);

    el.plugins = [];
    await settle(el);
    expect(log).toEqual(['connect a', 'connect b', 'cleanup b', 'cleanup a']);
  });

  test('a new array with the same plugins changes nothing', async () => {
    const log: string[] = [];
    const a = recorder('a', log);
    const el = await fixture({ columns, data: people(3), plugins: [a] });
    const plugins = el.plugins;
    el.plugins = [a];
    await settle(el);
    expect(el.plugins).toBe(plugins);
    expect(log).toEqual(['connect a']);
  });

  test('replacing the list keeps plugins that stay and connects new ones', async () => {
    const log: string[] = [];
    const a = recorder('a', log);
    const b = recorder('b', log);
    const c = recorder('c', log);
    const el = await fixture({ columns, data: people(3), plugins: [a, b] });
    el.plugins = [a, c];
    await settle(el);
    expect(log).toEqual(['connect a', 'connect b', 'cleanup b', 'connect c']);
  });

  test('cleans up on disconnect and connects again on reconnect', async () => {
    const log: string[] = [];
    const el = await fixture({ columns, data: people(3), plugins: [recorder('a', log)] });
    el.remove();
    expect(log).toEqual(['connect a', 'cleanup a']);
    document.body.append(el);
    await settle(el);
    expect(log).toEqual(['connect a', 'cleanup a', 'connect a']);
  });

  test('null and undefined mean no plugins', async () => {
    const el = await fixture({ columns, data: people(3) });
    el.plugins = null;
    expect(el.plugins).toEqual([]);
    el.plugins = undefined;
    expect(el.plugins).toEqual([]);
  });

  test('a plugin that throws is reported and skipped; the table still renders', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failedConnect: ArgusPlugin<Person> = {
      name: 'connect',
      connect() {
        throw new Error('boom');
      },
      // Off once connect threw: neither runs.
      columns: (defs) => [...defs, { id: 'extra', header: 'Extra' }],
      keydown: (event) => {
        event.preventDefault();
        return true;
      },
    };
    const failedHooks: ArgusPlugin<Person> = {
      name: 'hooks',
      columns() {
        throw new Error('boom');
      },
      keydown() {
        throw new Error('boom');
      },
    };
    const el = await fixture({
      columns,
      data: people(3),
      plugins: [failedConnect, failedHooks],
    });
    expect(rowText(rowsInOrder(el)[0] as Element)).toEqual(['Person 0', '0', 'City 0']);
    expect(error).toHaveBeenCalledWith(
      'argus-table: plugin "connect" threw in connect',
      expect.any(Error),
    );
    expect(error).toHaveBeenCalledWith(
      'argus-table: plugin "hooks" threw in columns',
      expect.any(Error),
    );
    // Neither takes the key: the table moves focus.
    const name = headerOf(el, 'name');
    name.focus();
    press(name, 'ArrowRight');
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'age'));
    expect(error).toHaveBeenCalledWith(
      'argus-table: plugin "hooks" threw in keydown',
      expect.any(Error),
    );
  });
});

describe('plugin columns', () => {
  test('transforms run in order and the table shows their output', async () => {
    const add: ArgusPlugin<Person> = {
      name: 'add',
      columns: (defs) => [...defs, { id: 'double', header: 'Double', accessor: (p) => p.age * 2 }],
    };
    const rename: ArgusPlugin<Person> = {
      name: 'rename',
      columns: (defs) => defs.map((d) => (d.id === 'double' ? { ...d, header: 'Twice' } : d)),
    };
    const el = await fixture({ columns, data: people(3), plugins: [add, rename] });
    expect(rowText(rowsInOrder(el)[2] as Element)).toEqual(['Person 2', '2', 'City 2', '4']);
    expect(slotted(headerOf(el, 'double'))?.textContent).toBe('Twice');
  });

  test('runs again only when columns, plugins or invalidateColumns() change', async () => {
    const spy = vi.fn((defs: readonly ColumnDef<Person>[]) => [...defs]);
    const { plugin, host } = hostGrabber();
    const el = await fixture(
      { columns, data: people(500), plugins: [plugin, { name: 'spy', columns: spy }] },
      { width: 800, height: 200 },
    );
    const calls = spy.mock.calls.length;
    await scrollTo(el, 2000);
    el.data = people(400);
    await settle(el);
    expect(spy.mock.calls.length).toBe(calls);

    host().invalidateColumns();
    await settle(el);
    expect(spy.mock.calls.length).toBe(calls + 1);

    el.columns = columns.slice(0, 2);
    await settle(el);
    expect(spy.mock.calls.length).toBe(calls + 2);
  });

  test('a header function from a plugin re-renders with requestUpdate()', async () => {
    let label = 'A';
    const { plugin, host } = hostGrabber();
    const wrap: ArgusPlugin<Person> = {
      name: 'wrap',
      columns: (defs) =>
        defs.map((d) => (d.id === 'name' ? { ...d, header: () => html`Name ${label}` } : d)),
    };
    const el = await fixture({ columns, data: people(3), plugins: [plugin, wrap] });
    const header = () => el.querySelector('[slot^="h-"]')?.textContent.trim();
    expect(header()).toBe('Name A');
    label = 'B';
    host().requestUpdate();
    await settle(el);
    expect(header()).toBe('Name B');
  });
});

describe('plugin keys', () => {
  test('a plugin that claims a key comes before the table', async () => {
    const seen: unknown[] = [];
    const claim: ArgusPlugin<Person> = {
      name: 'claim',
      keydown(event, target) {
        seen.push(target);
        if (event.key !== 'ArrowRight' || !event.altKey) return false;
        event.preventDefault();
        return true;
      },
    };
    const resizes: unknown[] = [];
    const el = await fixture({ columns, data: people(3), plugins: [claim] });
    el.addEventListener('argus-column-resize', (e) => resizes.push(e.detail));
    const name = headerOf(el, 'name');
    name.focus();
    expect(press(name, 'ArrowRight', { altKey: true }).defaultPrevented).toBe(true);
    await settle(el);
    expect(resizes).toEqual([]);
    expect(seen).toEqual([{ section: 'header', columnId: 'name', rowIndex: 0, rowId: undefined }]);

    // Unclaimed keys go on to the table: Alt+ArrowLeft still resizes.
    press(name, 'ArrowLeft', { altKey: true });
    await settle(el);
    expect(resizes).toHaveLength(1);
  });

  test('gets body cells with their row', async () => {
    const seen: unknown[] = [];
    const el = await fixture({
      columns,
      data: people(3),
      getRowId: (p) => p.id,
      plugins: [{ name: 'see', keydown: (_, target) => void seen.push(target) }],
    });
    const cell = shadow(el).querySelector<HTMLElement>('[aria-rowindex="3"] [data-col="age"]');
    if (!cell) throw new Error('no cell');
    press(cell, 'x');
    expect(seen).toEqual([{ section: 'body', columnId: 'age', rowIndex: 1, rowId: 'p1' }]);
  });
});

describe('plugin host', () => {
  const data = [
    { id: 'a', name: 'Ann', age: 30, address: { city: 'X' } },
    { id: 'b', name: 'Bob', age: 10, address: { city: 'Y' } },
    { id: 'c', name: 'Cid', age: 20, address: { city: 'Z' } },
  ];
  const ages = (el: ArgusTable<Person>) => rowsInOrder(el).map((r) => rowText(r)[1]);

  test('setSort sorts, clears and fires argus-sort-change (uncontrolled)', async () => {
    const { plugin, host } = hostGrabber();
    const el = await fixture({ columns, data, plugins: [plugin] });
    const events: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => events.push(e.detail.sorting));

    host().setSort('age', 'desc');
    await settle(el);
    expect(ages(el)).toEqual(['30', '20', '10']);
    expect(host().column('age')?.sorted).toBe('desc');

    // Clearing another column's sort changes nothing.
    host().setSort('name', null);
    host().setSort('age', 'desc');
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'age', desc: true }]);

    host().setSort('age', null);
    await settle(el);
    expect(el.sorting).toEqual([]);
    expect(events).toEqual([[{ id: 'age', desc: true }], []]);
  });

  test('setSort only proposes when sorting is controlled, and skips unsortable columns', async () => {
    const { plugin, host } = hostGrabber();
    const el = await fixture({ columns, data, sorting: [], plugins: [plugin] });
    const events: unknown[] = [];
    el.addEventListener('argus-sort-change', (e) => events.push(e.detail.sorting));
    host().setSort('age', 'asc');
    host().setSort('city', 'asc');
    await settle(el);
    expect(el.sorting).toEqual([]);
    expect(events).toEqual([[{ id: 'age', desc: false }]]);
  });

  test('column() describes resolved data columns, cellOf() finds a header', async () => {
    const { plugin, host } = hostGrabber();
    const el = await fixture({
      columns: columns.map((c) => (c.id === 'name' ? { ...c, pin: 'start' as const } : c)),
      data,
      plugins: [plugin],
      selectionMode: 'multi',
      selectionCheckboxes: true,
    });
    expect(host().column('name')).toEqual({
      id: 'name',
      sortable: true,
      resizable: true,
      pinnable: true,
      hideable: true,
      pin: 'start',
      hidden: false,
      width: 200,
      sorted: undefined,
    });
    expect(host().column('--argus-selection')).toBeUndefined();
    expect(host().column('nope')).toBeUndefined();

    let target: unknown;
    el.addEventListener('click', (e) => (target = host().cellOf(e)), { once: true });
    headerOf(el, 'city').click();
    expect(target).toEqual({ section: 'header', columnId: 'city', rowIndex: 0, rowId: undefined });
  });

  test('focusHeader focuses a column header', async () => {
    const { plugin, host } = hostGrabber();
    const el = await fixture({ columns, data, plugins: [plugin] });
    host().focusHeader('age');
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'age'));
  });

  test('row() reads body rows in the current order', async () => {
    const { plugin, host } = hostGrabber();
    const el = await fixture({ columns, data, plugins: [plugin] });
    expect(host().row?.(0)).toBe(data[0]);
    host().setSort('age', 'asc');
    await settle(el);
    expect([0, 1, 2].map((i) => host().row?.(i)?.name)).toEqual(['Bob', 'Cid', 'Ann']);
    expect(host().row?.(3)).toBeUndefined();
  });
});
