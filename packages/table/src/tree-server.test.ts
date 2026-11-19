import { html } from 'lit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ArgusTable } from './argus-table.js';
import { DataController, LOAD_DEBOUNCE_MS } from './controllers/data-controller.js';
import type {
  ArgusPlugin,
  CellClickDetail,
  ChildrenRequest,
  ColumnDef,
  DataSource,
  LoadErrorDetail,
  PluginHost,
  RowClickDetail,
  RowDetailContext,
  RowsRequest,
  TreeExpandedChangeDetail,
} from './types.js';
import {
  fixture,
  people,
  rowText,
  rowsInOrder,
  scrollTo,
  settle,
  shadow,
  type Person,
} from './test-utils.js';

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200, sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', width: 80 },
  { id: 'city', header: 'City', accessor: 'address.city', width: 120 },
];

interface Call {
  request: RowsRequest;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface ChildCall {
  request: ChildrenRequest<Person>;
  /** Answers with `count` children (the server's default when left out). */
  resolve: (count?: number) => void;
  reject: (error: unknown) => void;
}

/** `count` children of `parent`: `Person 1.0`, `Person 1.1`, … */
function childrenOf(parent: Person, count: number): Person[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${parent.id}.${String(i)}`,
    name: `${parent.name}.${String(i)}`,
    age: i,
    address: { city: 'Child' },
  }));
}

/**
 * A data source over `count` top-level people, each with `kids` children down to
 * `depth` levels, whose pages and children answer when the test says so.
 */
function server(count: number, { pageSize = 20, kids = 3, depth = 1, total = true } = {}) {
  const all = people(count);
  const calls: Call[] = [];
  const childCalls: ChildCall[] = [];
  const source: DataSource<Person> = {
    pageSize,
    getRows(request) {
      return new Promise((resolve, reject) => {
        calls.push({
          request,
          resolve: () => {
            const rows = all.slice(request.start, request.end);
            resolve(total ? { rows, total: count } : { rows });
          },
          reject,
        });
      });
    },
    hasChildren: (row) => row.name.split('.').length <= depth,
    getChildren(request) {
      return new Promise((resolve, reject) => {
        childCalls.push({
          request,
          resolve: (n = kids) => {
            resolve({ rows: childrenOf(request.parent, n) });
          },
          reject,
        });
      });
    },
  };
  return { source, calls, childCalls, all };
}

beforeEach(() => {
  // Only timers: the virtualizer and settle() still need real animation frames.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Lets the load debounce run out and the table catch up. */
async function load(el: ArgusTable<Person>) {
  await settle(el);
  vi.advanceTimersByTime(LOAD_DEBOUNCE_MS);
  await settle(el);
}

/** Answers the given calls and waits for the rows to render. */
async function answer(el: ArgusTable<Person>, calls: { resolve: () => void }[]) {
  for (const call of calls) call.resolve();
  await Promise.resolve();
  await load(el);
}

/** A table over `server`'s source with its first page loaded. */
async function loaded(
  source: DataSource<Person>,
  calls: Call[],
  props: Partial<ArgusTable<Person>> = {},
) {
  const el = await fixture({ columns, dataSource: source, ...props });
  await load(el);
  await answer(el, calls.slice(-1));
  return el;
}

/** The first cell's text of each row shown, the first `count` of them. */
const names = (el: HTMLElement, count = 6) =>
  rowsInOrder(el)
    .slice(0, count)
    .map((r) => (r.getAttribute('aria-busy') === 'true' ? '…' : rowText(r)[0]));

function rowOf(el: HTMLElement, name: string): HTMLElement {
  const row = rowsInOrder(el).find((r) => rowText(r).includes(name));
  if (!row) throw new Error(`no row ${name}`);
  return row;
}

/** Clicks the tree toggle of the row showing `name`. */
async function toggle(el: ArgusTable<Person>, name: string) {
  const button = rowOf(el, name).querySelector<HTMLButtonElement>('[part~="tree-toggle"]');
  if (!button) throw new Error(`no toggle in ${name}`);
  button.click();
  await load(el);
}

function events<D>(el: HTMLElement, name: string): D[] {
  const seen: D[] = [];
  el.addEventListener(name, (event) => {
    seen.push((event as CustomEvent<D>).detail);
  });
  return seen;
}

describe('tree rows from a data source', () => {
  test('expanding a row requests its children once, with the current sort and filters', async () => {
    const { source, calls, childCalls, all } = server(100);
    const sorting = [{ id: 'age', desc: true }];
    const filters = { city: { kind: 'text' as const, op: 'contains' as const, value: 'City' } };
    const el = await loaded(source, calls, {
      sorting,
      columnFilters: filters,
      quickFilter: 'Person',
    });
    expect(childCalls).toHaveLength(0);

    await toggle(el, 'Person 1');
    expect(childCalls).toHaveLength(1);
    const request = childCalls[0]?.request;
    expect(request).toMatchObject({ parentId: '1', sorting, filters, quickFilter: 'Person' });
    expect(request?.parent).toBe(all[1]);
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    // A loading row under the row until the answer.
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', '…', 'Person 2']);
    expect(rowsInOrder(el)[2]?.getAttribute('part')).toContain('row-loading');

    await answer(el, childCalls);
    expect(names(el)).toEqual([
      'Person 0',
      'Person 1',
      'Person 1.0',
      'Person 1.1',
      'Person 1.2',
      'Person 2',
    ]);

    // Collapsing keeps the children: no second request on the next expand.
    await toggle(el, 'Person 1');
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    await toggle(el, 'Person 1');
    expect(childCalls).toHaveLength(1);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 1.0']);
  });

  test('a row expanded by the property loads its children without a scroll', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    el.treeExpanded = ['2'];
    await load(el);
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['2']);
    await answer(el, childCalls);
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', 'Person 2', 'Person 2.0']);
  });

  test('collapse while the request is in flight, expand again: one request, its rows show', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await toggle(el, 'Person 1');
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    await toggle(el, 'Person 1');
    expect(childCalls).toHaveLength(1);
    expect(childCalls[0]?.request.signal.aborted).toBe(false);
    await answer(el, childCalls);
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', 'Person 1.0', 'Person 1.1']);
  });

  test('a failed child request shows Retry and fires argus-load-error with parentId', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    const errors = events<LoadErrorDetail>(el, 'argus-load-error');
    await toggle(el, 'Person 1');
    const failure = new Error('offline');
    childCalls[0]?.reject(failure);
    await Promise.resolve();
    await settle(el);
    expect(errors).toEqual([{ error: failure, start: 1, end: 2, parentId: '1' }]);

    const failed = (): HTMLElement => {
      const row = rowsInOrder(el)[2];
      if (!row) throw new Error('no row 2');
      return row;
    };
    expect(failed().getAttribute('part')).toContain('row-loading row-error');
    expect(failed().hasAttribute('aria-busy')).toBe(false);
    const retry = failed().querySelector<HTMLButtonElement>('[part~="retry"]');
    expect(retry?.getAttribute('aria-label')).toBe('Retry loading child rows');
    expect(retry?.textContent.trim()).toBe('Retry');
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', '', 'Person 2']);
    // Not asked for again on its own.
    await load(el);
    expect(childCalls).toHaveLength(1);

    // Retry by click: one request.
    retry?.click();
    await load(el);
    expect(childCalls).toHaveLength(2);
    expect(childCalls[1]?.request.parentId).toBe('1');
    childCalls[1]?.reject(failure);
    await Promise.resolve();
    await settle(el);
    expect(errors).toHaveLength(2);

    // Retry by Enter on the failed row.
    failed()
      .querySelector('[data-col="age"]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
      );
    await load(el);
    expect(childCalls).toHaveLength(3);
    await answer(el, childCalls.slice(2));
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', 'Person 1.0', 'Person 1.1']);
    expect(errors).toHaveLength(2);
    expect(shadow(el).querySelector('[part~="retry"]')).toBeNull();
  });

  test('the Retry label for child rows comes from labels', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { labels: { retryChildren: 'Nochmal' } });
    await toggle(el, 'Person 1');
    childCalls[0]?.reject(new Error('offline'));
    await Promise.resolve();
    await settle(el);
    expect(shadow(el).querySelector('[part~="retry"]')?.getAttribute('aria-label')).toBe('Nochmal');
  });

  test('a sort change drops in-flight child requests and reloads open rows', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    const old = childCalls[0];

    shadow(el).querySelector<HTMLElement>('[data-sort-col="name"]')?.click();
    await load(el);
    expect(old?.request.signal.aborted).toBe(true);
    // The parent's row isn't loaded in the new order yet: nothing to ask for.
    expect(childCalls).toHaveLength(1);
    await answer(el, calls.slice(-1));
    expect(childCalls).toHaveLength(2);
    expect(childCalls[1]?.request).toMatchObject({
      parentId: '1',
      sorting: [{ id: 'name', desc: false }],
    });

    // The late answer from before the sort changes nothing.
    old?.resolve(5);
    await Promise.resolve();
    await settle(el);
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', '…', 'Person 2']);

    await answer(el, childCalls.slice(1));
    expect(names(el, 6)).toEqual([
      'Person 0',
      'Person 1',
      'Person 1.0',
      'Person 1.1',
      'Person 1.2',
      'Person 2',
    ]);
  });

  test('refresh() keeps open rows’ child counts as loading rows', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    expect(rowOf(el, 'Person 2').getAttribute('aria-rowindex')).toBe('7');

    const body = () => shadow(el).querySelector<HTMLElement>('[part~="body"]');
    expect(body()?.style.blockSize).toBe('4120px');

    await el.refresh();
    await load(el);
    // Before the page answers, the open row keeps its three rows.
    expect(body()?.style.blockSize).toBe('4120px');
    await answer(el, calls.slice(-1));
    expect(names(el)).toEqual(['Person 0', 'Person 1', '…', '…', '…', 'Person 2']);
    expect(rowOf(el, 'Person 2').getAttribute('aria-rowindex')).toBe('7');
    expect(childCalls).toHaveLength(2);

    await answer(el, childCalls.slice(1));
    expect(names(el)).toEqual([
      'Person 0',
      'Person 1',
      'Person 1.0',
      'Person 1.1',
      'Person 1.2',
      'Person 2',
    ]);
  });

  test('refresh() with an open row above the view keeps the rows in view in place', async () => {
    const { source, calls, childCalls } = server(1000, { kids: 5 });
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await scrollTo(el, 40 * 30);
    await load(el);
    await answer(el, calls.slice(1));
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    const top = scroller?.scrollTop;
    /** The first row fully below the header. */
    const firstVisible = () => {
      const edge = (scroller?.getBoundingClientRect().top ?? 0) + 40 - 1;
      return rowsInOrder(el).find((r) => r.getBoundingClientRect().top >= edge);
    };
    const before = firstVisible();
    const index = before?.getAttribute('aria-rowindex');
    expect(rowText(before as Element)[0]).toMatch(/^Person 2\d$/);
    const name = rowText(before as Element)[0];

    const sent = calls.length;
    await el.refresh();
    await load(el);
    await answer(el, calls.slice(sent));
    expect(scroller?.scrollTop).toBe(top);
    expect(firstVisible()?.getAttribute('aria-rowindex')).toBe(index);
    expect(rowText(firstVisible() as Element)[0]).toBe(name);
    // Row 1's children load again, its five rows kept meanwhile.
    expect(childCalls).toHaveLength(2);
    await answer(el, childCalls.slice(1));
    expect(scroller?.scrollTop).toBe(top);
    expect(rowText(firstVisible() as Element)[0]).toBe(name);
  });

  test('refresh() keeps the rows under nested open rows', async () => {
    const { source, calls, childCalls } = server(100, { depth: 2, kids: 2 });
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await toggle(el, 'Person 1.0');
    await answer(el, childCalls.slice(1));
    expect(rowOf(el, 'Person 2').getAttribute('aria-rowindex')).toBe('8');

    await el.refresh();
    await load(el);
    await answer(el, calls.slice(-1));
    // Four rows under Person 1 (its two children, and two under Person 1.0) until it answers.
    expect(names(el, 7)).toEqual(['Person 0', 'Person 1', '…', '…', '…', '…', 'Person 2']);
    expect(rowOf(el, 'Person 2').getAttribute('aria-rowindex')).toBe('8');
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['1', '1.0', '1']);

    await answer(el, childCalls.slice(2));
    expect(names(el, 7)).toEqual([
      'Person 0',
      'Person 1',
      'Person 1.0',
      '…',
      '…',
      'Person 1.1',
      'Person 2',
    ]);
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['1', '1.0', '1', '1.0']);
    await answer(el, childCalls.slice(3));
    expect(names(el, 7)).toEqual([
      'Person 0',
      'Person 1',
      'Person 1.0',
      'Person 1.0.0',
      'Person 1.0.1',
      'Person 1.1',
      'Person 2',
    ]);
  });

  test('a child request failing under a row whose page was evicted reports the row’s index', async () => {
    const { source, calls, childCalls } = server(1000);
    const el = await loaded(source, calls);
    const errors = events<LoadErrorDetail>(el, 'argus-load-error');
    await toggle(el, 'Person 1');
    await scrollTo(el, 40 * 600);
    await load(el);
    const failure = new Error('offline');
    childCalls[0]?.reject(failure);
    await Promise.resolve();
    await settle(el);
    expect(errors).toEqual([{ error: failure, start: 1, end: 2, parentId: '1' }]);
  });

  test('a request failing after its row collapsed is not an error; the next expand asks again', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    const errors = events<LoadErrorDetail>(el, 'argus-load-error');
    await toggle(el, 'Person 1');
    await toggle(el, 'Person 1');
    childCalls[0]?.reject(new Error('offline'));
    await Promise.resolve();
    await load(el);
    expect(errors).toEqual([]);
    expect(childCalls).toHaveLength(1);

    await toggle(el, 'Person 1');
    expect(childCalls).toHaveLength(2);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', '…']);
    await answer(el, childCalls.slice(1));
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 1.0']);
    expect(shadow(el).querySelector('[part~="retry"]')).toBeNull();
  });

  test('focus on a loading child row stays there: its stand-in id isn’t a row’s id', async () => {
    const { source, calls } = server(100);
    const el = await loaded(source, calls);
    // A loading row at index 1; row "1" (default id) is loaded at index 2.
    await toggle(el, 'Person 0');
    const loading = rowsInOrder(el)[1];
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    loading?.querySelector<HTMLElement>('[data-col="age"]')?.focus();
    await settle(el);
    el.requestUpdate();
    await settle(el);
    const active = shadow(el).activeElement as HTMLElement | null;
    expect(active?.parentElement?.getAttribute('aria-rowindex')).toBe('3');
    expect(active?.parentElement?.getAttribute('aria-busy')).toBe('true');
  });

  test('at most 6 child requests at a time; every open row is asked once', async () => {
    const { source, calls, childCalls } = server(100);
    const open = Array.from({ length: 20 }, (_, i) => String(i));
    const el = await loaded(source, calls, { treeExpanded: open });
    expect(childCalls).toHaveLength(6);

    // A sort: every open row loads its children again, once its row is loaded.
    shadow(el).querySelector<HTMLElement>('[data-sort-col="name"]')?.click();
    await load(el);
    expect(childCalls.every((c) => c.request.signal.aborted)).toBe(true);
    const start = childCalls.length;
    await answer(el, calls.slice(-1));
    expect(childCalls.length - start).toBe(6);
    for (let done = 0; done < childCalls.length - start; done++) {
      childCalls[start + done]?.resolve();
      await Promise.resolve();
      await load(el);
      expect(childCalls.length - start - (done + 1)).toBeLessThanOrEqual(6);
    }
    const asked = childCalls.slice(start).map((c) => c.request.parentId);
    expect(asked).toHaveLength(20);
    expect(new Set(asked)).toEqual(new Set(open));
  });

  test('getRows still pages top-level rows', async () => {
    const { source, calls, childCalls } = server(1000, { kids: 50 });
    const el = await loaded(source, calls);
    await toggle(el, 'Person 0');
    await answer(el, childCalls);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 0.0', 'Person 0.1']);

    // Shown index 60 is top-level row 10 (50 children above it).
    await scrollTo(el, 60 * 40);
    await load(el);
    expect(calls.map((c) => [c.request.start, c.request.end])).toEqual([
      [0, 20],
      [20, 40],
    ]);
    await answer(el, calls.slice(1));
    expect(rowsInOrder(el).some((r) => rowText(r)[0] === 'Person 10')).toBe(true);
  });

  test('a failed page reports shown indexes, counting open rows’ children above it', async () => {
    const { source, calls, childCalls } = server(1000, { kids: 50 });
    const el = await loaded(source, calls);
    const errors = events<LoadErrorDetail>(el, 'argus-load-error');
    await toggle(el, 'Person 0');
    await answer(el, childCalls);
    await scrollTo(el, 60 * 40);
    await load(el);
    expect(calls[1]?.request).toMatchObject({ start: 20, end: 40 });
    const failure = new Error('offline');
    calls[1]?.reject(failure);
    await Promise.resolve();
    await settle(el);
    // Top-level rows 20–39 are shown rows 70–89: Person 0's 50 children come first.
    expect(errors).toEqual([{ error: failure, start: 70, end: 90 }]);
    // The Retry button counts them too, in the page's first row shown.
    const retry = shadow(el).querySelector('[part~="retry"]');
    expect(retry?.getAttribute('aria-label')).toBe('Retry loading rows 71 to 90');
    expect(retry?.closest('[role="row"]')?.getAttribute('aria-rowindex')).toBe(String(70 + 2));
  });

  test('a data table’s treeExpanded leaves the data source alone', async () => {
    const configure = vi.spyOn(DataController.prototype, 'configure');
    const el = await fixture({
      columns,
      data: people(3),
      getSubRows: (row: Person) => (row.id === 'p1' ? childrenOf(row, 2) : undefined),
    });
    configure.mockClear();
    el.treeExpanded = ['1'];
    await settle(el);
    expect(names(el, 4)).toEqual(['Person 0', 'Person 1', 'Person 1.0', 'Person 1.1']);
    expect(configure).not.toHaveBeenCalled();
  });

  test('children of children load on expand', async () => {
    const { source, calls, childCalls } = server(100, { depth: 2, kids: 2 });
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await toggle(el, 'Person 1.0');
    expect(childCalls).toHaveLength(2);
    expect(childCalls[1]?.request.parentId).toBe('1.0');
    expect(childCalls[1]?.request.parent.name).toBe('Person 1.0');
    await answer(el, childCalls.slice(1));
    expect(names(el)).toEqual([
      'Person 0',
      'Person 1',
      'Person 1.0',
      'Person 1.0.0',
      'Person 1.0.1',
      'Person 1.1',
    ]);
    // Grandchildren have no children (depth 2): no toggle.
    expect(rowOf(el, 'Person 1.0.0').querySelector('[part~="tree-toggle"]')).toBeNull();
  });

  test('without getChildren nothing changes', async () => {
    const { source, calls } = server(100);
    const flat = { ...source };
    delete flat.getChildren;
    const el = await loaded(flat, calls);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    expect(shadow(el).querySelector('[part~="tree-toggle"]')).toBeNull();
    expect(rowsInOrder(el)[0]?.hasAttribute('aria-level')).toBe(false);
  });

  test('ids used twice warn once, also across resets', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { source, calls, childCalls } = server(100);
    // Every child of row 1 takes the id of top-level row 5.
    const el = await loaded(source, calls, {
      getRowId: (row: Person) => (row.name.includes('.') ? 'p5' : row.id),
    });
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    const collisions = () =>
      warn.mock.calls.filter((args) => String(args[0]).includes('more than one row'));
    expect(collisions()).toHaveLength(1);

    await el.refresh();
    await load(el);
    await answer(el, calls.slice(-1));
    await answer(el, childCalls.slice(1));
    expect(childCalls).toHaveLength(2);
    expect(collisions()).toHaveLength(1);
  });

  test('disconnecting aborts child requests; reconnecting asks again', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    el.remove();
    expect(childCalls[0]?.request.signal.aborted).toBe(true);
    document.body.append(el);
    await load(el);
    expect(childCalls).toHaveLength(2);
    await answer(el, childCalls.slice(1));
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 1.0']);
  });
});

describe('tree rows from a data source: branch selection', () => {
  const branches = {
    selectionMode: 'multi',
    selectionCheckboxes: true,
    selectBranches: true,
  } as const;

  function checkbox(el: HTMLElement, name: string): HTMLInputElement {
    const box = rowOf(el, name).querySelector<HTMLInputElement>(
      '[data-col="--argus-selection"] input',
    );
    if (!box) throw new Error(`no checkbox in ${name}`);
    return box;
  }

  const checkAll = (el: HTMLElement) => {
    const box = shadow(el).querySelector<HTMLInputElement>('[part~="header-cell-selection"] input');
    if (!box) throw new Error('no select-all checkbox');
    return box;
  };

  /** Clicks a checkbox and waits for the update. */
  async function tick(el: ArgusTable<Person>, box: HTMLInputElement) {
    box.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await settle(el);
  }

  const sorted = (ids: readonly string[]) => [...ids].sort();
  /** The ids of the first page's top-level rows. */
  const firstPage = Array.from({ length: 20 }, (_, i) => String(i));

  test('ticking a loaded parent selects it and its loaded children', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, branches);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');

    await tick(el, checkbox(el, 'Person 1'));
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2']);
    expect(seen).toHaveLength(1);
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: true, indeterminate: false });
    expect(checkbox(el, 'Person 1.1')).toMatchObject({ checked: true, indeterminate: false });
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: true });

    // Unticking a child: the parent is part-ticked and its id goes.
    await tick(el, checkbox(el, 'Person 1.1'));
    expect(sorted(el.selection)).toEqual(['1.0', '1.2']);
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: false, indeterminate: true });
    // Ticking it again completes the branch.
    await tick(el, checkbox(el, 'Person 1.1'));
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2']);
    expect(seen).toHaveLength(3);
  });

  test('a parent with unloaded children ticks as a leaf; its children join when they arrive', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, branches);
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');
    await tick(el, checkbox(el, 'Person 1'));
    expect(el.selection).toEqual(['1']);
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: true, indeterminate: false });

    await toggle(el, 'Person 1');
    expect(seen).toHaveLength(1);
    await answer(el, childCalls);
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2']);
    // One event for the arrival, after the update that shows the children.
    expect(seen).toHaveLength(2);
    expect(sorted(seen[1]?.selection ?? [])).toEqual(['1', '1.0', '1.1', '1.2']);
    expect(checkbox(el, 'Person 1.2')).toMatchObject({ checked: true });
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: true, indeterminate: false });

    // Children of a row that isn't selected stay out.
    await toggle(el, 'Person 2');
    await answer(el, childCalls.slice(-1));
    expect(seen).toHaveLength(2);
    expect(checkbox(el, 'Person 2.0')).toMatchObject({ checked: false });
  });

  test('controlled: children arriving under a ticked parent are proposed, not applied', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { ...branches, selection: ['1'] });
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    expect(seen).toHaveLength(1);
    expect(sorted(seen[0]?.selection ?? [])).toEqual(['1', '1.0', '1.1', '1.2']);
    expect(el.selection).toEqual(['1']);
    // Shown as it is: the parent's id without its children.
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkbox(el, 'Person 1.0')).toMatchObject({ checked: false });
    await settle(el);
    expect(seen).toHaveLength(1);
  });

  test('select-all covers the loaded rows, children of collapsed rows too', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, branches);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await toggle(el, 'Person 1');
    expect(checkAll(el)).toMatchObject({ checked: false, indeterminate: false });

    await tick(el, checkAll(el));
    expect(sorted(el.selection)).toEqual(sorted([...firstPage, '1.0', '1.1', '1.2']));
    expect(checkAll(el)).toMatchObject({ checked: true, indeterminate: false });
    await tick(el, checkAll(el));
    expect(el.selection).toEqual([]);
  });

  test('a sort reloads children under a selected parent: they join again, no duplicates', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, branches);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await tick(el, checkbox(el, 'Person 1'));
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');

    el.sorting = [{ id: 'name', desc: false }];
    await load(el);
    await answer(el, calls.slice(-1));
    expect(childCalls).toHaveLength(2);
    // The three it had again, and a new one: the new one joins, once.
    childCalls[1]?.resolve(4);
    await Promise.resolve();
    await load(el);
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2', '1.3']);
    expect(seen).toHaveLength(1);
    expect(checkbox(el, 'Person 1.3')).toMatchObject({ checked: true });
  });

  test('grandchildren arriving under a selected child join it', async () => {
    const { source, calls, childCalls } = server(100, { depth: 2 });
    const el = await loaded(source, calls, branches);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await tick(el, checkbox(el, 'Person 1'));
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');
    await toggle(el, 'Person 1.0');
    await answer(el, childCalls.slice(-1));
    expect(sorted(el.selection)).toEqual(
      sorted(['1', '1.0', '1.0.0', '1.0.1', '1.0.2', '1.1', '1.2']),
    );
    expect(seen).toHaveLength(1);
    expect(checkbox(el, 'Person 1.0.1')).toMatchObject({ checked: true });
  });

  test('a parent unticked before its children arrive: nothing joins', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, branches);
    await tick(el, checkbox(el, 'Person 1'));
    await toggle(el, 'Person 1');
    await tick(el, checkbox(el, 'Person 1'));
    expect(el.selection).toEqual([]);
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');
    await answer(el, childCalls);
    expect(el.selection).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  test('controlled: a handler of the arrival event can set other properties', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { ...branches, selection: ['1'] });
    el.addEventListener('argus-selection-change', (event) => {
      el.selection = event.detail.selection;
      el.treeExpanded = [...el.treeExpanded, '3'];
    });
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await load(el);
    expect(sorted(el.selection)).toEqual(['1', '1.0', '1.1', '1.2']);
    expect(el.treeExpanded).toEqual(['1', '3']);
    expect(rowOf(el, 'Person 3').getAttribute('aria-expanded')).toBe('true');
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['1', '3']);
  });

  test('the header checkbox stays enabled while the rows reload', async () => {
    const { source, calls } = server(100);
    const el = await loaded(source, calls, branches);
    await tick(el, checkbox(el, 'Person 3'));
    el.sorting = [{ id: 'name', desc: true }];
    await load(el);
    expect(checkAll(el)).toMatchObject({ disabled: false, checked: false, indeterminate: false });
    await answer(el, calls.slice(-1));
    expect(checkAll(el)).toMatchObject({ disabled: false, indeterminate: true });
  });

  test('under a server filter a parent’s id stays out; clearing the filter adds nothing', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { ...branches, quickFilter: 'x' });
    await toggle(el, 'Person 1');
    // Under the filter the server sends one child.
    childCalls[0]?.resolve(1);
    await Promise.resolve();
    await load(el);
    const seen = events<{ selection: string[] }>(el, 'argus-selection-change');
    await tick(el, checkbox(el, 'Person 1'));
    expect(el.selection).toEqual(['1.0']);
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: false, indeterminate: true });
    expect(seen).toHaveLength(1);

    el.quickFilter = '';
    await load(el);
    await answer(el, calls.slice(-1));
    childCalls[childCalls.length - 1]?.resolve(3);
    await Promise.resolve();
    await load(el);
    expect(el.selection).toEqual(['1.0']);
    expect(seen).toHaveLength(1);
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: false, indeterminate: true });
    expect(checkbox(el, 'Person 1.1')).toMatchObject({ checked: false });
  });

  test('under a server filter a parent without loaded children can’t be ticked', async () => {
    const { source, calls } = server(100);
    const el = await loaded(source, calls, { ...branches, quickFilter: 'x' });
    expect(checkbox(el, 'Person 2').disabled).toBe(true);
    await tick(el, checkbox(el, 'Person 2'));
    expect(el.selection).toEqual([]);
    el.quickFilter = '';
    await load(el);
    await answer(el, calls.slice(-1));
    expect(checkbox(el, 'Person 2').disabled).toBe(false);
    await tick(el, checkbox(el, 'Person 2'));
    expect(el.selection).toEqual(['2']);
  });

  test('filters that keep every row and a blank quick filter don’t count as a server filter', async () => {
    const { source, calls } = server(100);
    const el = await loaded(source, calls, {
      ...branches,
      columns: columns.map((c) => (c.id === 'name' ? { ...c, filter: 'text' as const } : c)),
      columnFilters: { name: { kind: 'text', op: 'contains', value: '' } },
      quickFilter: '  ',
    });
    expect(checkbox(el, 'Person 2').disabled).toBe(false);
    await tick(el, checkbox(el, 'Person 2'));
    expect(el.selection).toEqual(['2']);
  });

  test('without selectBranches nothing changes', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { ...branches, selectBranches: false });
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await tick(el, checkbox(el, 'Person 1'));
    expect(el.selection).toEqual(['1']);
    expect(checkbox(el, 'Person 1')).toMatchObject({ checked: true, indeterminate: false });

    // Children arriving under a selected row stay out.
    await toggle(el, 'Person 1');
    await tick(el, checkbox(el, 'Person 2'));
    await toggle(el, 'Person 2');
    await answer(el, childCalls.slice(-1));
    expect(sorted(el.selection)).toEqual(['1', '2']);

    // Select-all: the loaded rows shown.
    await toggle(el, 'Person 2');
    await tick(el, checkAll(el));
    expect(sorted(el.selection)).toEqual(sorted(firstPage));
  });
});

describe('tree rows from a data source: rendering, keys and state', () => {
  /** The tree column's cell in the body row showing `name`. */
  function cellOf(el: HTMLElement, name: string, col = 'name'): HTMLElement {
    const cell = rowOf(el, name).querySelector<HTMLElement>(`[data-col="${col}"]`);
    if (!cell) throw new Error(`no ${col} cell in ${name}`);
    return cell;
  }

  /** The body row at a shown index. */
  function rowAt(el: HTMLElement, index: number): HTMLElement {
    const row = rowsInOrder(el).find((r) => r.getAttribute('aria-rowindex') === String(index + 2));
    if (!row) throw new Error(`no row at ${String(index)}`);
    return row;
  }

  const treeAttributes = (row: Element) =>
    Object.fromEntries(
      ['aria-level', 'aria-expanded', 'aria-setsize', 'aria-posinset'].map((name) => [
        name,
        row.getAttribute(name),
      ]),
    );

  /** Real key presses on whatever has focus. */
  async function press(el: ArgusTable<Person>, keys: string) {
    await userEvent.keyboard(keys);
    await load(el);
  }

  const focused = (el: HTMLElement) => shadow(el).activeElement;

  const scroller = (el: HTMLElement) => {
    const s = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    if (!s) throw new Error('no scroller');
    return s;
  };

  /** The first body row wholly below the header, by its first cell's text. */
  function topRowText(el: HTMLElement): string | undefined {
    const header = shadow(el).querySelector<HTMLElement>('[part~="header"]');
    const top = (header?.getBoundingClientRect().bottom ?? 0) - 0.5;
    const row = rowsInOrder(el).find((r) => r.getBoundingClientRect().top >= top);
    return row ? rowText(row)[0] : undefined;
  }

  test('loaded remote rows get toggles and tree ARIA', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    expect(el.getAttribute('role')).toBe('treegrid');
    expect(treeAttributes(rowOf(el, 'Person 0'))).toEqual({
      'aria-level': '1',
      'aria-expanded': 'false',
      'aria-setsize': '100',
      'aria-posinset': '1',
    });
    expect(cellOf(el, 'Person 0').querySelector('[part~="tree-toggle"]')).not.toBeNull();

    await toggle(el, 'Person 1');
    expect(treeAttributes(rowOf(el, 'Person 1'))).toMatchObject({
      'aria-level': '1',
      'aria-expanded': 'true',
      'aria-posinset': '2',
    });
    await answer(el, childCalls);
    expect(treeAttributes(rowOf(el, 'Person 1.1'))).toEqual({
      'aria-level': '2',
      'aria-expanded': null,
      'aria-setsize': '3',
      'aria-posinset': '2',
    });
    // A child without children: a spacer, no toggle.
    expect(cellOf(el, 'Person 1.1').querySelector('[part~="tree-toggle"]')).toBeNull();
    expect(cellOf(el, 'Person 1.1').querySelector('.tree-spacer')).not.toBeNull();
    // The row after the children keeps its place among the top-level rows.
    expect(treeAttributes(rowOf(el, 'Person 2'))).toMatchObject({
      'aria-level': '1',
      'aria-posinset': '3',
    });
  });

  test('aria-setsize is -1 while the total is unknown', async () => {
    const { source, calls } = server(100, { total: false });
    const el = await loaded(source, calls);
    expect(rowOf(el, 'Person 0').getAttribute('aria-setsize')).toBe('-1');
    expect(rowOf(el, 'Person 0').getAttribute('aria-posinset')).toBe('1');
  });

  test('loading and failed child rows sit at their depth', async () => {
    const { source, calls, childCalls } = server(100, { depth: 2, kids: 2 });
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    const loading = rowAt(el, 2);
    expect(loading.getAttribute('aria-busy')).toBe('true');
    // A level, but no toggle state or place among siblings: those aren't known yet.
    expect(treeAttributes(loading)).toEqual({
      'aria-level': '2',
      'aria-expanded': null,
      'aria-setsize': null,
      'aria-posinset': null,
    });
    const skeleton = loading.querySelector<HTMLElement>('[data-col="name"] > [part~="skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(loading.querySelector('[data-col="name"] [part~="tree-toggle"]')).toBeNull();
    // The bar starts where the children's content will.
    const barLeft = skeleton?.getBoundingClientRect().left ?? NaN;
    await answer(el, childCalls);
    const content = cellOf(el, 'Person 1.0').querySelector('slot')?.assignedElements()[0];
    expect(barLeft).toBeCloseTo(content?.getBoundingClientRect().left ?? NaN, 0);
    expect(barLeft).toBeGreaterThan(
      cellOf(el, 'Person 1').querySelector('slot')?.assignedElements()[0]?.getBoundingClientRect()
        .left ?? NaN,
    );

    // One level deeper, and failed: still at its depth, the Retry button after the indent.
    await toggle(el, 'Person 1.0');
    childCalls[1]?.reject(new Error('offline'));
    await Promise.resolve();
    await settle(el);
    const failed = rowAt(el, 3);
    expect(failed.getAttribute('part')).toContain('row-error');
    expect(treeAttributes(failed)).toEqual({
      'aria-level': '3',
      'aria-expanded': null,
      'aria-setsize': null,
      'aria-posinset': null,
    });
    const retry = failed.querySelector<HTMLElement>('[data-col="name"] > [part~="retry"]');
    expect(retry?.getBoundingClientRect().left).toBeGreaterThan(barLeft);
    // Other columns: a bar without an indent.
    expect(failed.querySelector('[data-col="age"] .tree-indent')).toBeNull();
  });

  test('rows of a page still loading are top-level rows', async () => {
    const { source, calls } = server(1000);
    const el = await loaded(source, calls);
    await scrollTo(el, 40 * 500);
    await load(el);
    const row = rowsInOrder(el).find((r) => r.getAttribute('aria-busy') === 'true');
    expect(row?.getAttribute('aria-level')).toBe('1');
    expect(row?.hasAttribute('aria-expanded')).toBe(false);
    expect(row?.hasAttribute('aria-setsize')).toBe(false);
    expect(row?.querySelector('[data-col="name"] > [part~="skeleton"]')).not.toBeNull();
  });

  test('without getChildren loading rows carry no level', async () => {
    const { source, calls } = server(1000);
    const flat = { ...source };
    delete flat.getChildren;
    const el = await loaded(flat, calls);
    await scrollTo(el, 40 * 500);
    await load(el);
    const row = rowsInOrder(el).find((r) => r.getAttribute('aria-busy') === 'true');
    expect(row).toBeDefined();
    expect(row?.hasAttribute('aria-level')).toBe(false);
    expect(shadow(el).querySelector('.tree-indent')).toBeNull();
  });

  test('empty children remove the toggle, and the row stays expanded', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    childCalls[0]?.resolve(0);
    await Promise.resolve();
    await load(el);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    expect(rowAt(el, 2).hasAttribute('aria-busy')).toBe(false);
    const row = rowOf(el, 'Person 1');
    expect(row.querySelector('[part~="tree-toggle"]')).toBeNull();
    expect(row.querySelector('.tree-spacer')).not.toBeNull();
    expect(treeAttributes(row)).toMatchObject({ 'aria-level': '1', 'aria-expanded': null });
    expect(el.treeExpanded).toEqual(['1']);
    expect(childCalls).toHaveLength(1);
  });

  test('Right expands and Left goes to the parent, then collapses', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    cellOf(el, 'Person 1').focus();
    await settle(el);
    await press(el, '{ArrowRight}');
    expect(seen).toEqual([{ treeExpanded: ['1'], rowId: '1', open: true }]);
    expect(focused(el)).toBe(cellOf(el, 'Person 1'));

    // Left on the loading row goes to its parent too.
    await press(el, '{ArrowDown}');
    expect(focused(el)?.parentElement?.getAttribute('aria-busy')).toBe('true');
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'Person 1'));

    await answer(el, childCalls);
    // Right on an expanded row moves right.
    await press(el, '{ArrowRight}');
    expect(focused(el)).toBe(cellOf(el, 'Person 1', 'age'));
    await press(el, '{ArrowLeft}{ArrowDown}{ArrowDown}');
    expect(focused(el)).toBe(cellOf(el, 'Person 1.1'));
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'Person 1'));
    await press(el, '{ArrowLeft}');
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    expect(focused(el)).toBe(cellOf(el, 'Person 1'));
    expect(seen.at(-1)).toEqual({ treeExpanded: [], rowId: '1', open: false });
    expect(childCalls).toHaveLength(1);
  });

  test('Right on a row with empty children moves right', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { treeExpanded: ['1'] });
    childCalls[0]?.resolve(0);
    await Promise.resolve();
    await load(el);
    cellOf(el, 'Person 1').focus();
    await settle(el);
    await press(el, '{ArrowRight}');
    expect(focused(el)).toBe(cellOf(el, 'Person 1', 'age'));
    expect(el.treeExpanded).toEqual(['1']);
  });

  test('Left on a failed child row goes to its parent', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    childCalls[0]?.reject(new Error('offline'));
    await Promise.resolve();
    await settle(el);
    const failed = rowAt(el, 2);
    expect(failed.getAttribute('part')).toContain('row-error');
    failed.querySelector<HTMLElement>('[data-col="name"]')?.focus();
    await settle(el);
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'Person 1'));
    expect(el.treeExpanded).toEqual(['1']);
  });

  test('focus on a row still loading stays on it as rows load above it', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { treeExpanded: ['25'] });
    await scrollTo(el, 22 * 40);
    await load(el);
    expect(calls).toHaveLength(2);
    // Top-level row 30, not loaded: shown index 30 while row 25 isn't loaded (so not open).
    const skeleton = rowAt(el, 30);
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    skeleton.querySelector<HTMLElement>('[data-col="age"]')?.focus();
    await settle(el);

    // Its page loads: row 25 opens with a loading row, so row 30 is at 31 now.
    await answer(el, calls.slice(1));
    expect(focused(el)).toBe(cellOf(el, 'Person 30', 'age'));
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['25']);
    await answer(el, childCalls);
    expect(rowOf(el, 'Person 30').getAttribute('aria-rowindex')).toBe(String(33 + 2));
    expect(focused(el)).toBe(cellOf(el, 'Person 30', 'age'));
  });

  test('focus on a row still loading doesn’t pull the view back as rows load above it', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    // Person 1's children are in flight: one loading row under it.
    await toggle(el, 'Person 1');
    await scrollTo(el, 22 * 40);
    await load(el);
    // Top-level row 29, its page not answered: shown index 30.
    const cell = rowAt(el, 30).querySelector<HTMLElement>('[data-col="age"]');
    expect(rowAt(el, 30).getAttribute('aria-busy')).toBe('true');
    cell?.focus();
    await settle(el);
    await scrollTo(el, 0);
    await load(el);

    // Three children replace the loading row: row 29 moves down by two, out of view.
    await answer(el, childCalls);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 1.0']);
    expect(scroller(el).scrollTop).toBe(0);
    expect(rowAt(el, 32).getAttribute('aria-busy')).toBe('true');
    expect(focused(el)).toBe(cell);
    expect(rowAt(el, 32).contains(cell ?? null)).toBe(true);
  });

  test('focus on a loading child row moves to the child once loaded, or to the parent', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    rowAt(el, 2).querySelector<HTMLElement>('[data-col="age"]')?.focus();
    await settle(el);
    await answer(el, childCalls);
    expect(focused(el)).toBe(cellOf(el, 'Person 1.0', 'age'));

    // Fewer rows than placeholders after a refresh: the parent takes it.
    await el.refresh();
    await load(el);
    await answer(el, calls.slice(-1));
    expect(names(el, 6)).toEqual(['Person 0', 'Person 1', '…', '…', '…', 'Person 2']);
    rowAt(el, 4).querySelector<HTMLElement>('[data-col="age"]')?.focus();
    await settle(el);
    childCalls[1]?.resolve(1);
    await Promise.resolve();
    await load(el);
    expect(focused(el)).toBe(cellOf(el, 'Person 1', 'age'));
  });

  test('collapsing from outside moves the active cell from a loading child row to the row', async () => {
    const { source, calls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    expect(rowAt(el, 2).getAttribute('aria-busy')).toBe('true');
    rowAt(el, 2).querySelector<HTMLElement>('[data-col="age"]')?.focus();
    await settle(el);
    el.treeExpanded = [];
    await load(el);
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    expect(focused(el)).toBe(cellOf(el, 'Person 1', 'age'));
  });

  test('collapsing moves the active cell from a child to the row', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    cellOf(el, 'Person 1.2', 'age').focus();
    await settle(el);
    await toggle(el, 'Person 1');
    expect(names(el, 3)).toEqual(['Person 0', 'Person 1', 'Person 2']);
    expect(focused(el)).toBe(cellOf(el, 'Person 1'));

    // By the host, in the same column.
    el.treeExpanded = ['1'];
    await load(el);
    cellOf(el, 'Person 1.2', 'age').focus();
    await settle(el);
    el.treeExpanded = [];
    await load(el);
    expect(focused(el)).toBe(cellOf(el, 'Person 1', 'age'));
  });

  test('getState and setState carry treeExpanded with a data source', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await fixture({ columns, dataSource: source });
    await load(el);
    // Restored before the first page answers: the children are asked for once it has.
    const restored = el.setState({ treeExpanded: ['1'], scroll: { row: 3, inline: 0 } });
    await load(el);
    expect(childCalls).toHaveLength(0);
    await answer(el, calls.slice(-1));
    await restored;
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['1']);
    expect(el.getState().treeExpanded).toEqual(['1']);
    // The scroll row is a shown index: while the children load, a loading row is at 2.
    expect(el.getState().scroll.row).toBe(3);
    expect(topRowText(el)).toBe('Person 2');
    await answer(el, childCalls);
    expect(el.getState().scroll.row).toBe(3);
    expect(topRowText(el)).toBe('Person 1.1');
    expect(childCalls).toHaveLength(1);
  });

  test('getState() restores into a new table with a data source', async () => {
    const first = server(100);
    const a = await loaded(first.source, first.calls);
    await toggle(a, 'Person 1');
    await answer(a, first.childCalls);
    await toggle(a, 'Person 4');
    await answer(a, first.childCalls.slice(1));
    await a.scrollToRow(6);
    await load(a);
    expect(topRowText(a)).toBe('Person 3');
    const state = a.getState();
    expect(state.treeExpanded).toEqual(['1', '4']);
    expect(state.scroll.row).toBe(6);
    a.remove();

    const { source, calls, childCalls } = server(100);
    const b = await fixture({ columns, dataSource: source });
    await load(b);
    const restored = b.setState(state);
    await load(b);
    await answer(b, calls.slice(-1));
    await restored;
    expect(b.treeExpanded).toEqual(['1', '4']);
    expect(childCalls.map((c) => c.request.parentId)).toEqual(['1', '4']);
    // The scroll row is a shown index: a loading row under each open row until it answers.
    expect(names(b, 7)).toEqual([
      'Person 0',
      'Person 1',
      '…',
      'Person 2',
      'Person 3',
      'Person 4',
      '…',
    ]);
    await answer(b, childCalls);
    expect(topRowText(b)).toBe('Person 3');
    expect(b.getState().scroll.row).toBe(6);
    expect(childCalls).toHaveLength(2);
  });

  test('cell clicks, row clicks and rowDetail get depth for remote children', async () => {
    const { source, calls, childCalls } = server(100);
    const details: RowDetailContext<Person>[] = [];
    const el = await loaded(source, calls, {
      expanded: ['1.0'],
      rowDetail: (context) => {
        details.push(context);
        return html`<p>Details of ${context.row.name}</p>`;
      },
    });
    const cells = events<CellClickDetail<Person>>(el, 'argus-cell-click');
    const rows = events<RowClickDetail<Person>>(el, 'argus-row-click');
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    cellOf(el, 'Person 1.1', 'age').click();
    cellOf(el, 'Person 2', 'age').click();
    expect(cells.map((d) => [d.rowId, d.depth])).toEqual([
      ['1.1', 1],
      ['2', 0],
    ]);
    expect(rows.map((d) => [d.rowId, d.depth])).toEqual([
      ['1.1', 1],
      ['2', 0],
    ]);
    const panel = details.findLast((c) => c.rowId === '1.0');
    expect(panel?.depth).toBe(1);
    expect(panel?.index).toBe(2);
  });

  test('plugins read depth; source rows stay undefined', async () => {
    let host: PluginHost<Person> | undefined;
    const plugin: ArgusPlugin<Person> = {
      name: 'grab',
      connect(h) {
        host = h;
      },
    };
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, { plugins: [plugin] });
    if (!host) throw new Error('no host');
    await toggle(el, 'Person 1');
    // A loading row is at its parent's depth plus one.
    expect(host.rowDepth(2)).toBe(1);
    await answer(el, childCalls);
    expect(host.rowDepth(1)).toBe(0);
    expect(host.rowDepth(2)).toBe(1);
    expect(host.rowDepth(5)).toBe(0);
    expect(host.rowDepth(999)).toBe(0);
    expect(host.sourceRow(0)).toBeUndefined();
    expect(host.sourceRow(2)).toBeUndefined();
  });

  test('scrollToRow finds loaded children, not those under a collapsed row', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls);
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    await expect(el.scrollToRow({ id: '1.2' })).resolves.toBe(true);
    await load(el);
    expect(topRowText(el)).toBe('Person 1.2');

    // Indexes count the rows shown: 5 is Person 2.
    await expect(el.scrollToRow(5)).resolves.toBe(true);
    await load(el);
    expect(topRowText(el)).toBe('Person 2');

    await expect(el.scrollToRow(0)).resolves.toBe(true);
    await load(el);
    await toggle(el, 'Person 1');
    await expect(el.scrollToRow({ id: '1.2' })).resolves.toBe(false);
    expect(scroller(el).scrollTop).toBe(0);
  });
});
