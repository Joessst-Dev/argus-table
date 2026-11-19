import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import { LOAD_DEBOUNCE_MS } from './controllers/data-controller.js';
import type {
  ChildrenRequest,
  ColumnDef,
  DataSource,
  LoadErrorDetail,
  RowsRequest,
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
function server(count: number, { pageSize = 20, kids = 3, depth = 1 } = {}) {
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
            resolve({ rows: all.slice(request.start, request.end), total: count });
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

  test('branch selection waits for remote trees: a ticked row selects only itself', async () => {
    const { source, calls, childCalls } = server(100);
    const el = await loaded(source, calls, {
      selectionMode: 'multi',
      selectionCheckboxes: true,
      selectBranches: true,
    });
    await toggle(el, 'Person 1');
    await answer(el, childCalls);
    const box = rowOf(el, 'Person 1').querySelector<HTMLInputElement>(
      '[data-col="--argus-selection"] input',
    );
    box?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
    );
    await settle(el);
    expect(el.selection).toEqual(['1']);
  });
});
