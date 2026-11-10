import { afterEach, describe, expect, test } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type { ArgusPlugin, ColumnDef, PluginHost } from './index.js';
import { fixture, people, rowText, rowsInOrder, settle, shadow, slotted } from './test-utils.js';
import type { Person } from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 120, sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', width: 80 },
  { id: 'city', header: 'City', accessor: 'address.city', width: 100 },
  { id: 'id', header: 'Id', accessor: 'id', width: 90 },
];

const headers = (el: HTMLElement) =>
  [...shadow(el).querySelectorAll<HTMLElement>('[role="columnheader"]')].sort(
    (a, b) => Number(a.ariaColIndex) - Number(b.ariaColIndex),
  );
const headerIds = (el: HTMLElement) => headers(el).map((h) => h.dataset.col);
const headerOf = (el: HTMLElement, id: string) => {
  const h = shadow(el).querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};

/** A plugin that hands its host to the test. */
function grab(): { plugin: ArgusPlugin<Person>; host: () => PluginHost<Person> } {
  let host: PluginHost<Person> | undefined;
  return {
    plugin: {
      name: 'grab',
      connect(h) {
        host = h;
        return undefined;
      },
    },
    host: () => {
      if (!host) throw new Error('not connected');
      return host;
    },
  };
}

/** Records the events of a type, with the state of the table when each one fired. */
function record<K extends 'argus-column-hide' | 'argus-column-pin'>(
  el: ArgusTable<Person>,
  type: K,
  read: () => unknown,
): { detail: HTMLElementEventMap[K]['detail']; state: unknown }[] {
  const seen: { detail: HTMLElementEventMap[K]['detail']; state: unknown }[] = [];
  el.addEventListener(type, (e) => {
    seen.push({ detail: e.detail, state: read() });
  });
  return seen;
}

describe('column visibility', () => {
  test('columnVisibility hides columns: headers, cells, their content and the ARIA indices', async () => {
    const el = await fixture({ columns, data: people(3), columnVisibility: { age: false } });
    expect(headerIds(el)).toEqual(['name', 'city', 'id']);
    const row = rowsInOrder(el)[0] as Element;
    expect(rowText(row)).toEqual(['Person 0', 'City 0', 'p0']);
    expect(row.querySelector('[data-col="city"]')?.getAttribute('aria-colindex')).toBe('2');
    // No light-DOM content is left for the hidden column.
    expect([...el.children].some((c) => c.textContent === 'Age')).toBe(false);

    el.columnVisibility = {};
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city', 'id']);
    expect(slotted(headerOf(el, 'age'))?.textContent).toBe('Age');
  });

  test('a column defined as hidden shows once columnVisibility says so', async () => {
    const defs = columns.map((c) => (c.id === 'id' ? { ...c, hidden: true } : c));
    const el = await fixture({ columns: defs, data: people(2) });
    expect(headerIds(el)).toEqual(['name', 'age', 'city']);
    el.columnVisibility = { id: true };
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city', 'id']);
  });

  test('sorting by a hidden column keeps the rows sorted', async () => {
    const el = await fixture({
      columns,
      data: people(3),
      sorting: [{ id: 'name', desc: true }],
      columnVisibility: { name: false },
    });
    expect(rowsInOrder(el).map((r) => rowText(r)[2])).toEqual(['p2', 'p1', 'p0']);
  });

  test('setHidden hides and shows, then fires argus-column-hide with the state applied', async () => {
    const { plugin, host } = grab();
    const el = await fixture({ columns, data: people(2), plugins: [plugin] });
    const seen = record(el, 'argus-column-hide', () => headerIds(el));
    host().setHidden?.('city', true);
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'id']);
    expect(el.columnVisibility).toEqual({ city: false });
    expect(seen).toEqual([
      {
        detail: { columnId: 'city', hidden: true, visibility: { city: false } },
        state: ['name', 'age', 'id'],
      },
    ]);
    host().setHidden?.('city', false);
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city', 'id']);
    expect(seen[1]?.detail).toEqual({
      columnId: 'city',
      hidden: false,
      visibility: { city: true },
    });
  });

  test('controlled: setHidden only proposes', async () => {
    const { plugin, host } = grab();
    const el = await fixture({
      columns,
      data: people(2),
      plugins: [plugin],
      columnVisibility: { id: false },
    });
    const seen = record(el, 'argus-column-hide', () => headerIds(el));
    host().setHidden?.('age', true);
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city']);
    expect(seen.map((s) => s.detail)).toEqual([
      { columnId: 'age', hidden: true, visibility: { id: false, age: false } },
    ]);
    el.columnVisibility = seen[0]?.detail.visibility;
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'city']);
  });

  test('refuses to hide the last column shown, or one with hideable: false', async () => {
    const { plugin, host } = grab();
    const defs = columns.map((c) => (c.id === 'name' ? { ...c, hideable: false } : c));
    const el = await fixture({
      columns: defs,
      data: people(1),
      plugins: [plugin],
      columnVisibility: { age: false, city: false },
    });
    const seen = record(el, 'argus-column-hide', () => undefined);
    host().setHidden?.('name', true);
    el.columnVisibility = { age: false, city: false, name: false };
    await settle(el);
    expect(headerIds(el)).toEqual(['id']);
    host().setHidden?.('id', true);
    await settle(el);
    expect(headerIds(el)).toEqual(['id']);
    expect(seen).toEqual([]);
  });

  test('lists hidden columns to plugins', async () => {
    const { plugin, host } = grab();
    const el = await fixture({
      columns,
      data: people(1),
      plugins: [plugin],
      columnVisibility: { age: false },
    });
    expect(host().column('age')).toMatchObject({ id: 'age', hidden: true, hideable: true });
    expect(host().column('name')).toMatchObject({ hidden: false, pinnable: true });
    expect(
      host()
        .columns?.()
        .map((c) => [c.id, c.hidden]),
    ).toEqual([
      ['name', false],
      ['age', true],
      ['city', false],
      ['id', false],
    ]);
    expect(el.columnVisibility).toEqual({ age: false });
  });

  test('a focused header that is hidden hands focus to the next column', async () => {
    const { plugin, host } = grab();
    const el = await fixture({ columns, data: people(2), plugins: [plugin] });
    headerOf(el, 'age').focus();
    await settle(el);
    host().setHidden?.('age', true);
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'city'));
    // The last column gives way to the one before it.
    host().setHidden?.('id', true);
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'city']);
    headerOf(el, 'city').focus();
    host().setHidden?.('city', true);
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'name'));
  });

  test('Alt+Shift+Arrow steps over hidden columns', async () => {
    const el = await fixture({ columns, data: people(1), columnVisibility: { age: false } });
    headerOf(el, 'name').focus();
    headerOf(el, 'name').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await settle(el);
    expect(headerIds(el)).toEqual(['city', 'name', 'id']);
    // The hidden column kept its place before city.
    expect(el.columnOrder).toEqual(['age', 'city', 'name', 'id']);
  });
});

describe('column pinning', () => {
  const pinOf = (el: HTMLElement, id: string) => headerOf(el, id).dataset.pin;

  test('columnPinning pins and unpins over the columns own pin', async () => {
    const defs = columns.map((c) => (c.id === 'name' ? { ...c, pin: 'start' as const } : c));
    const el = await fixture({
      columns: defs,
      data: people(2),
      columnPinning: { name: false, id: 'start', age: 'end' },
    });
    expect(headerIds(el)).toEqual(['id', 'name', 'city', 'age']);
    expect(pinOf(el, 'id')).toBe('start');
    expect(pinOf(el, 'name')).toBeUndefined();
    expect(pinOf(el, 'age')).toBe('end');
    const cell = rowsInOrder(el)[0]?.querySelector('[data-col="id"]');
    expect(cell?.getAttribute('part')).toContain('cell-pinned-edge');
    el.columnPinning = {};
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city', 'id']);
    expect(pinOf(el, 'name')).toBe('start');
  });

  test('a pinned column stays put while the others scroll', async () => {
    const wide = Array.from({ length: 12 }, (_, i): ColumnDef<Person> => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      width: 150,
    }));
    const el = await fixture({ columns: wide, data: people(2), columnPinning: { c5: 'start' } });
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    if (!scroller) throw new Error('no scroller');
    const before = headerOf(el, 'c5').getBoundingClientRect().left;
    scroller.scrollLeft = 600;
    await settle(el);
    expect(headerOf(el, 'c5').getBoundingClientRect().left).toBeCloseTo(before, 0);
    expect(headerOf(el, 'c5').getBoundingClientRect().left).toBeCloseTo(
      scroller.getBoundingClientRect().left + scroller.clientLeft,
      0,
    );
  });

  test('a pinned flex column takes a fixed width', async () => {
    const defs: ColumnDef<Person>[] = [
      { id: 'name', header: 'Name', accessor: 'name', width: { flex: 1 } },
      { id: 'age', header: 'Age', accessor: 'age', width: 80 },
    ];
    const el = await fixture({ columns: defs, data: people(1), columnPinning: { name: 'end' } });
    expect(headerIds(el)).toEqual(['age', 'name']);
    expect(headerOf(el, 'name').getBoundingClientRect().width).toBeCloseTo(150, 0);
  });

  test('setPin pins, then fires argus-column-pin with the state applied', async () => {
    const { plugin, host } = grab();
    const el = await fixture({ columns, data: people(2), plugins: [plugin] });
    const seen = record(el, 'argus-column-pin', () => headerIds(el));
    host().setPin?.('city', 'start');
    await settle(el);
    expect(el.columnPinning).toEqual({ city: 'start' });
    expect(seen).toEqual([
      {
        detail: { columnId: 'city', pin: 'start', pinning: { city: 'start' } },
        state: ['city', 'name', 'age', 'id'],
      },
    ]);
    expect(host().column('city')?.pin).toBe('start');
    host().setPin?.('city', false);
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city', 'id']);
  });

  test('controlled: setPin only proposes; pinnable: false refuses', async () => {
    const { plugin, host } = grab();
    const defs = columns.map((c) => (c.id === 'age' ? { ...c, pinnable: false } : c));
    const el = await fixture({
      columns: defs,
      data: people(2),
      plugins: [plugin],
      columnPinning: {},
    });
    const seen = record(el, 'argus-column-pin', () => headerIds(el));
    host().setPin?.('age', 'end');
    host().setPin?.('id', 'start');
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city', 'id']);
    expect(seen.map((s) => s.detail)).toEqual([
      { columnId: 'id', pin: 'start', pinning: { id: 'start' } },
    ]);
  });

  test('with virtualizeColumns, a column pinned out of view renders', async () => {
    const wide = Array.from({ length: 60 }, (_, i): ColumnDef<Person> => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      width: 100,
    }));
    const el = await fixture({ columns: wide, data: people(2), virtualizeColumns: true });
    expect(headerIds(el)).not.toContain('c50');
    el.columnPinning = { c50: 'end' };
    await settle(el);
    expect(headerIds(el)).toContain('c50');
    expect(headerOf(el, 'c50').dataset.pin).toBe('end');
    expect(slotted(headerOf(el, 'c50'))?.textContent).toBe('C50');
  });
});

describe('<argus-column> pinning and visibility', () => {
  test('reads hidden, pinnable and hideable, and follows the hidden attribute', async () => {
    const el = document.createElement('argus-table') as ArgusTable<Person>;
    el.style.inlineSize = '600px';
    el.style.blockSize = '300px';
    el.innerHTML = `
      <argus-column column-id="name" header="Name" accessor="name" pinnable="false"></argus-column>
      <argus-column column-id="age" header="Age" accessor="age" hidden></argus-column>
      <argus-column column-id="city" header="City" accessor="address.city" hideable="false"></argus-column>`;
    el.data = people(2);
    const { plugin, host } = grab();
    el.plugins = [plugin];
    document.body.append(el);
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'city']);
    expect(host().column('name')).toMatchObject({ pinnable: false, hideable: true });
    expect(host().column('city')).toMatchObject({ pinnable: true, hideable: false });

    const age = el.querySelector<HTMLElement>('argus-column[column-id="age"]');
    if (!age) throw new Error('no age column');
    age.hidden = false;
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'age', 'city']);
    age.setAttribute('hidden', '');
    await settle(el);
    expect(headerIds(el)).toEqual(['name', 'city']);
  });
});
