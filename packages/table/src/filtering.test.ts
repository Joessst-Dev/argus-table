import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type { ArgusColumn } from './argus-column.js';
import './argus-column.js';
import type {
  ArgusPlugin,
  ColumnDef,
  ColumnFilterState,
  DataSource,
  PluginHost,
  RowsRequest,
} from './index.js';
import { setMaxElementHeightForTests } from './max-height.js';
import { fixture, people, rowText, rowsInOrder, settle, shadow } from './test-utils.js';
import type { Person } from './test-utils.js';

afterEach(() => {
  setMaxElementHeightForTests(undefined);
  document.body.replaceChildren();
});

// people(n): name 'Person i', age i % 90, city 'City {i % 7}', id 'p{i}'.
const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 140, filter: 'text' },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, filter: 'number', sortable: true },
  { id: 'city', header: 'City', accessor: 'address.city', width: 100, filter: 'set' },
  { id: 'id', header: 'Id', accessor: 'id', width: 80 },
];
const getRowId = (p: Person) => p.id;

const names = (el: HTMLElement) => rowsInOrder(el).map((r) => rowText(r)[0]);
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

describe('columnFilters', () => {
  test('shows only the rows every filter keeps', async () => {
    const el = await fixture({
      columns,
      data: people(30),
      columnFilters: {
        city: { kind: 'set', values: ['City 1'] },
        age: { kind: 'number', op: 'lt', value: 20 },
      },
    });
    expect(names(el)).toEqual(['Person 1', 'Person 8', 'Person 15']);

    el.columnFilters = {};
    await settle(el);
    expect(rowsInOrder(el).length).toBeGreaterThan(3);
  });

  test.runIf('ariaRowCount' in ElementInternals.prototype)(
    'counts the rows left for assistive tech',
    async () => {
      // ElementInternals can't be read from outside, so watch what the table sets.
      const counts: string[] = [];
      const spy = vi
        .spyOn(ElementInternals.prototype, 'ariaRowCount', 'set')
        .mockImplementation((value: string | null) => {
          counts.push(String(value));
        });
      try {
        const el = await fixture({ columns, data: people(30) });
        expect(counts.at(-1)).toBe('31');
        el.quickFilter = 'p29';
        await settle(el);
        // The header and one row.
        expect(counts.at(-1)).toBe('2');
      } finally {
        spy.mockRestore();
      }
    },
  );

  test('marks filtered headers with a part, an indicator and a description', async () => {
    const el = await fixture({
      columns,
      data: people(5),
      columnFilters: { age: { kind: 'number', op: 'notEmpty' } },
    });
    const age = headerOf(el, 'age');
    expect(age.part.contains('header-cell-filtered')).toBe(true);
    expect(age.getAttribute('aria-description')).toBe('Filtered');
    expect(age.querySelector('[part~="filter-indicator"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    const name = headerOf(el, 'name');
    expect(name.part.contains('header-cell-filtered')).toBe(false);
    expect(name.hasAttribute('aria-description')).toBe(false);
    expect(name.querySelector('[part~="filter-indicator"]')).toBeNull();
  });

  test('filters by a hidden column and sorts what is left', async () => {
    const el = await fixture({
      columns,
      data: people(30),
      columnVisibility: { city: false },
      columnFilters: { city: { kind: 'set', values: ['City 2'] } },
      sorting: [{ id: 'age', desc: true }],
    });
    expect(names(el)).toEqual(['Person 23', 'Person 16', 'Person 9', 'Person 2']);
  });

  test('uses a column filterFn', async () => {
    const even: ColumnDef<Person> = {
      id: 'age',
      accessor: 'age',
      filter: 'number',
      filterFn: (value) => (value as number) % 2 === 0,
    };
    const el = await fixture({
      columns: [{ id: 'name', accessor: 'name' }, even],
      data: people(6),
      columnFilters: { age: { kind: 'number', op: 'eq' } },
    });
    expect(names(el)).toEqual(['Person 0', 'Person 2', 'Person 4']);
  });

  test('shows the empty state when no row is left', async () => {
    const el = await fixture({
      columns,
      data: people(5),
      columnFilters: { name: { kind: 'text', op: 'equals', value: 'nobody' } },
    });
    expect(shadow(el).querySelector('[part="empty"]')).not.toBeNull();
    expect(rowsInOrder(el)).toHaveLength(0);
  });
});

describe('quickFilter', () => {
  test('keeps rows that have each word in a shown column, ignoring case', async () => {
    const el = await fixture({ columns, data: people(30) });
    // "3" is found in "Person 13" too: each word may be in any column.
    el.quickFilter = 'city 3  PERSON 1';
    await settle(el);
    expect(names(el)).toEqual(['Person 10', 'Person 13', 'Person 17']);

    // A hidden column isn't searched.
    el.columnVisibility = { city: false };
    await settle(el);
    expect(names(el)).toEqual([]);
  });

  test('reads the quick-filter attribute', async () => {
    const el = await fixture({ columns, data: people(30) });
    el.setAttribute('quick-filter', 'p29');
    await settle(el);
    expect(el.quickFilter).toBe('p29');
    expect(names(el)).toEqual(['Person 29']);
    el.quickFilter = undefined;
    await settle(el);
    expect(el.quickFilter).toBe('');
  });

  test('announces the number of rows left', async () => {
    const el = await fixture({ columns, data: people(30) });
    el.quickFilter = 'p1';
    await settle(el);
    const region = document.querySelector('[data-argus-announcer]');
    await vi.waitFor(() => {
      // p1, p10–p19.
      expect(region?.textContent).toBe('11 rows');
    });
    el.quickFilter = 'p29';
    await settle(el);
    await vi.waitFor(() => {
      expect(region?.textContent).toBe('1 row');
    });
  });
});

describe('filters from plugins', () => {
  test('uncontrolled: setFilter applies, then fires argus-column-filters-change after the update', async () => {
    const { plugin, host } = grab();
    const el = await fixture({ columns, data: people(20), plugins: [plugin] });
    const seen: { detail: unknown; rows: number }[] = [];
    el.addEventListener('argus-column-filters-change', (e) => {
      seen.push({ detail: e.detail, rows: rowsInOrder(el).length });
    });
    const filter = { kind: 'text', op: 'contains', value: 'person 1' } as const;
    host().setFilter('name', filter);
    await settle(el);
    expect(el.columnFilters).toEqual({ name: filter });
    expect(seen).toEqual([
      {
        detail: { columnId: 'name', columnFilter: filter, columnFilters: { name: filter } },
        rows: 11,
      },
    ]);

    host().setFilter('name', undefined);
    await settle(el);
    expect(el.columnFilters).toEqual({});
    expect(seen[1]?.detail).toEqual({
      columnId: 'name',
      columnFilter: undefined,
      columnFilters: {},
    });
  });

  test('controlled: setFilter only proposes', async () => {
    const { plugin, host } = grab();
    const el = await fixture({ columns, data: people(5), plugins: [plugin], columnFilters: {} });
    const seen: unknown[] = [];
    el.addEventListener('argus-column-filters-change', (e) => seen.push(e.detail));
    const filter = { kind: 'number', op: 'gt', value: 2 } as const;
    host().setFilter('age', filter);
    await settle(el);
    expect(seen).toEqual([
      { columnId: 'age', columnFilter: filter, columnFilters: { age: filter } },
    ]);
    expect(el.columnFilters).toEqual({});
    expect(rowsInOrder(el)).toHaveLength(5);

    // Handing it back makes it uncontrolled again.
    el.columnFilters = undefined;
    host().setFilter('age', filter);
    await settle(el);
    expect(names(el)).toEqual(['Person 3', 'Person 4']);
  });

  test('ignores columns without a filter kind, and no-change requests', async () => {
    const { plugin, host } = grab();
    const el = await fixture({ columns, data: people(5), plugins: [plugin] });
    const seen: unknown[] = [];
    el.addEventListener('argus-column-filters-change', (e) => seen.push(e.detail));
    host().setFilter('id', { kind: 'text', op: 'empty' });
    host().setFilter('name', undefined);
    await settle(el);
    expect(seen).toEqual([]);
  });

  test('describes filters in ColumnInfo and lists the values a set filter offers', async () => {
    const { plugin, host } = grab();
    const el = await fixture({
      columns,
      data: people(30),
      plugins: [plugin],
      columnFilters: { age: { kind: 'number', op: 'lt', value: 7 } },
    });
    expect(host().column('age')).toMatchObject({
      filter: 'number',
      columnFilter: { kind: 'number', op: 'lt', value: 7 },
    });
    expect(host().column('id')).toMatchObject({ filter: undefined, columnFilter: undefined });
    // Ages 0–6 are people 0–6, one per city.
    expect(host().filterValues('city')?.values).toHaveLength(7);
    el.columnFilters = { age: { kind: 'number', op: 'lt', value: 2 } };
    await settle(el);
    expect(host().filterValues('city')).toEqual({
      values: ['City 0', 'City 1'],
      truncated: false,
    });
  });
});

describe('filteredIndexes', () => {
  test('lists the data indexes of the rows the filters keep, leaving out the except columns', async () => {
    const { plugin, host } = grab();
    const el = await fixture({
      columns,
      data: people(10),
      plugins: [plugin],
      sorting: [{ id: 'age', desc: true }],
      columnFilters: { age: { kind: 'number', op: 'lt', value: 7 } },
    });
    expect(host().filteredIndexes()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(host().filteredIndexes(['age'])).toHaveLength(10);
    el.quickFilter = 'City 3';
    await settle(el);
    expect(host().filteredIndexes()).toEqual([3]);
    expect(host().filteredIndexes(['name'])).toEqual([3]);
    // Only the city column has "City 3" in it.
    expect(host().filteredIndexes(['city'])).toEqual([]);
  });

  test('a column can read it from its accessor while the table filters and sorts', async () => {
    let read: (() => readonly Person[]) | undefined;
    // The row's share of the ages of the rows the filters keep (leaving out its own).
    const share: ColumnDef<Person> = {
      id: 'share',
      accessor: (p) => {
        const rows = read?.() ?? [];
        const total = rows.reduce((sum, r) => sum + r.age, 0);
        return total ? p.age / total : 0;
      },
      sortable: true,
      filter: 'number',
    };
    const plugin: ArgusPlugin<Person> = {
      name: 'share',
      connect(host) {
        read = () =>
          (host.filteredIndexes(['share']) ?? []).flatMap((i) => host.element.data[i] ?? []);
      },
    };
    const el = await fixture({
      columns: [...columns.map((c) => ({ ...c, filter: 'number' as const })), share],
      data: people(5),
      plugins: [plugin],
      sorting: [{ id: 'share', desc: true }],
      columnFilters: {
        age: { kind: 'number', op: 'ge', value: 1 },
        share: { kind: 'number', op: 'gt', value: 0.2 },
      },
    });
    // Ages 1–4 total 10: shares 0.1–0.4, and the filter on share keeps 0.3 and 0.4.
    expect(names(el)).toEqual(['Person 4', 'Person 3']);
  });
});

describe('filters with focus and selection', () => {
  test('a focused row that is filtered out hands focus to the row in its place', async () => {
    const el = await fixture({ columns, data: people(10), getRowId });
    const cell = rowsInOrder(el)[4]?.querySelector<HTMLElement>('[data-col="name"]');
    cell?.focus();
    await settle(el);
    el.columnFilters = { age: { kind: 'number', op: 'ne', value: 4 } };
    await settle(el);
    const focused = shadow(el).activeElement as HTMLElement | null;
    expect(focused?.closest('[role="row"]')?.getAttribute('aria-rowindex')).toBe('6');
    expect(focused?.dataset.col).toBe('name');
  });

  test('select-all selects the rows left, and the checkbox follows the filters', async () => {
    const el = await fixture({
      columns,
      data: people(14),
      getRowId,
      selectionMode: 'multi',
      selectionCheckboxes: true,
      columnFilters: { city: { kind: 'set', values: ['City 0'] } },
    });
    const checkAll = () =>
      shadow(el).querySelector<HTMLInputElement>('[part~="header-cell-selection"] input');
    checkAll()?.click();
    await settle(el);
    expect(el.selection).toEqual(['p0', 'p7']);
    expect(checkAll()).toMatchObject({ checked: true, indeterminate: false });

    el.columnFilters = {};
    await settle(el);
    expect(checkAll()).toMatchObject({ checked: false, indeterminate: true });
  });
});

describe('filters on a scaled body', () => {
  test('a filter that shrinks a scrolled, scaled body shows its rows', async () => {
    setMaxElementHeightForTests(100_000);
    const el = await fixture({ columns, data: people(10_000) });
    await el.scrollToRow(9_000);
    await settle(el);
    // Person 99, 990–999 and 9900–9999: 111 rows, under the cap. The scroll position
    // was far below their end, so the table shows the last of them.
    el.columnFilters = { name: { kind: 'text', op: 'startsWith', value: 'person 99' } };
    await settle(el);
    await settle(el);
    const shown = names(el);
    expect(shown.length).toBeGreaterThan(8);
    expect(shown.every((name) => name?.startsWith('Person 99'))).toBe(true);
    expect(shown.at(-1)).toBe('Person 9999');
  });
});

describe('filters with a dataSource', () => {
  function server(count: number) {
    const all = people(count);
    const requests: RowsRequest[] = [];
    const source: DataSource<Person> = {
      pageSize: 20,
      getRows(request) {
        requests.push(request);
        // A pretend server: filters by city and the quick filter on the name.
        const city = request.filters.city;
        const rows = all.filter(
          (p) =>
            (city?.kind !== 'set' || city.values.includes(p.address.city)) &&
            p.name.toLowerCase().includes(request.quickFilter.toLowerCase()),
        );
        return Promise.resolve({
          rows: rows.slice(request.start, request.end),
          total: rows.length,
        });
      },
    };
    return { source, requests };
  }

  test('sends the filters and the quick filter, and loads from the top again', async () => {
    const { source, requests } = server(100);
    const el = await fixture({ columns, dataSource: source });
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(requests[0]).toMatchObject({ start: 0, filters: {}, quickFilter: '' });
    await settle(el);

    const filters: ColumnFilterState = { city: { kind: 'set', values: ['City 3'] } };
    el.columnFilters = filters;
    el.quickFilter = 'person 1';
    await settle(el);
    await vi.waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ start: 0, filters, quickFilter: 'person 1' });
    });
    // The count comes from the filtered answer, not the old one: no skeleton rows.
    await vi.waitFor(() => {
      expect(names(el)).toEqual(['Person 10', 'Person 17']);
    });
    expect(rowsInOrder(el)).toHaveLength(2);
  });

  test('offers filterOptions for a set filter, nothing else', async () => {
    const { source } = server(10);
    const { plugin, host } = grab();
    const defs = columns.map((c) =>
      c.id === 'city' ? { ...c, filterOptions: ['City 0', 'City 1'] } : c,
    );
    await fixture({ columns: defs, dataSource: source, plugins: [plugin] });
    expect(host().filterValues('city')).toEqual({
      values: ['City 0', 'City 1'],
      truncated: false,
    });
    expect(host().filterValues('name')).toBeUndefined();
  });
});

describe('<argus-column> filters', () => {
  test('reads the filter attribute and the filterOptions property', async () => {
    const el = document.createElement('argus-table') as ArgusTable<Person>;
    el.style.cssText = 'inline-size: 600px; block-size: 300px';
    el.innerHTML = `
      <argus-column column-id="name" accessor="name" filter="text"></argus-column>
      <argus-column column-id="city" accessor="address.city" filter="set"></argus-column>`;
    const city = el.querySelector<ArgusColumn>('argus-column[column-id="city"]');
    if (!city) throw new Error('no column');
    city.filterOptions = ['City 2'];
    el.data = people(10);
    const { plugin, host } = grab();
    el.plugins = [plugin];
    document.body.append(el);
    await settle(el);
    expect(host().column('name')?.filter).toBe('text');
    expect(host().filterValues('city')?.values).toEqual(['City 2']);
    el.columnFilters = { city: { kind: 'set', values: ['City 2'] } };
    await settle(el);
    expect(names(el)).toEqual(['Person 2', 'Person 9']);
  });
});
