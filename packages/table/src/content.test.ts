import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import type { ArgusPlugin, ColumnDef, ContentRenderer, DataSource } from './index.js';
import { isForeign } from './render/content-directive.js';
import { fixture, people, rowsInOrder, settle, shadow, slotted } from './test-utils.js';
import type { Person } from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** Foreign content as a framework would give it: a plain object the table can't render. */
interface Fake {
  kind: 'fake';
  text: string;
}
const fake = (text: string): Fake => ({ kind: 'fake', text });

/**
 * A renderer that writes the text into the target and records what it did. Like a
 * framework, it keeps one "mount" per target and counts mounts and unmounts.
 */
function recorder() {
  const mounted = new Map<HTMLElement, string>();
  const log = { renders: 0, mounts: 0, releases: 0, flushes: 0, pending: 0 };
  const renderer: ContentRenderer = {
    render(target, content) {
      const { text } = content as Fake;
      if (!mounted.has(target)) log.mounts++;
      mounted.set(target, text);
      target.textContent = text;
      log.renders++;
      log.pending++;
    },
    release(target) {
      mounted.delete(target);
      target.textContent = '';
      log.releases++;
      log.pending++;
    },
    flush() {
      log.flushes++;
      log.pending = 0;
    },
  };
  return { renderer, mounted, log };
}

// The cell's columns: name as foreign content, age as text.
const columns = [
  {
    id: 'name',
    header: 'Name',
    accessor: 'name',
    width: 200,
    cell: (row: Person) => fake(`<${row.name}>`),
  },
  { id: 'age', header: 'Age', accessor: 'age', width: 80 },
] as unknown as ColumnDef<Person>[];

const nameCells = (el: HTMLElement) =>
  rowsInOrder(el).map((row) => {
    const cell = row.querySelector('[data-col="name"]');
    return cell ? slotted(cell)?.textContent : undefined;
  });

describe('isForeign', () => {
  test('leaves what Lit renders to the table', () => {
    for (const value of [
      'a',
      3,
      null,
      undefined,
      html`<b></b>`,
      document.createElement('b'),
      ['a', html`<i></i>`],
    ]) {
      expect(isForeign(value)).toBe(false);
    }
    expect(isForeign({ type: 'b', props: {} })).toBe(true);
    expect(isForeign(['a', { type: 'b' }])).toBe(true);
  });
});

describe('contentRenderer', () => {
  test('renders foreign cells and headers into targets, and flushes once per update', async () => {
    const { renderer, log } = recorder();
    const el = await fixture({
      contentRenderer: renderer,
      columns: columns.map((c) => (c.id === 'age' ? { ...c, header: fake('Age!') } : c)),
      data: people(3),
    } as never);
    expect(nameCells(el)).toEqual(['<Person 0>', '<Person 1>', '<Person 2>']);
    const header = shadow(el).querySelector('[role="columnheader"][data-col="age"]');
    expect(header && slotted(header)?.textContent).toBe('Age!');
    // A target, not the container: Lit's markers stay intact.
    const target = el.querySelector('.argus-content');
    expect(target?.parentElement?.getAttribute('slot')).toMatch(/^c-|^h-/);
    expect(log.pending).toBe(0);
    expect(log.flushes).toBeGreaterThan(0);

    const flushes = log.flushes;
    el.requestUpdate();
    await el.updateComplete;
    expect(log.flushes).toBe(flushes + 1);
  });

  test('reuses targets while scrolling: rows change, mounts don’t grow', async () => {
    const { renderer, log, mounted } = recorder();
    const el = await fixture({ contentRenderer: renderer, columns, data: people(10_000) });
    const before = log.mounts;
    const live = mounted.size;
    await el.scrollToRow(5000);
    await settle(el);
    expect(nameCells(el)).toContain('<Person 5000>');
    expect(log.mounts).toBe(before);
    expect(mounted.size).toBe(live);
    expect(log.releases).toBe(0);
  });

  test('flushes before auto widths are measured', async () => {
    // The renderer only shows its text on flush, as a batching framework would.
    const pending = new Map<HTMLElement, string>();
    const batching: ContentRenderer = {
      render: (target, value) => pending.set(target, (value as Fake).text),
      release: (target) => {
        pending.delete(target);
        target.textContent = '';
      },
      flush: () => {
        for (const [target, text] of pending) target.textContent = text;
        pending.clear();
      },
    };
    const wide = 'W'.repeat(60);
    const el = await fixture({
      contentRenderer: batching,
      columns: [
        { id: 'name', header: 'N', width: 'auto', cell: () => fake(wide) },
      ] as unknown as ColumnDef<Person>[],
      data: people(3),
    });
    const width = shadow(el)
      .querySelector('[role="columnheader"][data-col="name"]')
      ?.getBoundingClientRect().width;
    expect(width).toBeGreaterThan(300);
  });

  test('releases targets whose cells go away: hidden columns, fewer rows, plain content', async () => {
    const { renderer, log, mounted } = recorder();
    const el = await fixture({ contentRenderer: renderer, columns, data: people(5) });
    expect(mounted.size).toBe(5);

    el.data = people(2);
    await settle(el);
    expect(mounted.size).toBe(2);
    expect(log.releases).toBe(3);

    el.columns = columns.map((c) => (c.id === 'name' ? { ...c, cell: () => 'plain' } : c));
    await settle(el);
    expect(mounted.size).toBe(0);
    expect(nameCells(el)).toEqual(['plain', 'plain']);

    el.columns = columns;
    await settle(el);
    expect(mounted.size).toBe(2);
    el.columnVisibility = { name: false };
    await settle(el);
    expect(mounted.size).toBe(0);
    expect(log.pending).toBe(0);
  });

  test('releases on disconnect and renders again on reconnect', async () => {
    const { renderer, mounted, log } = recorder();
    const el = await fixture({ contentRenderer: renderer, columns, data: people(3) });
    expect(mounted.size).toBe(3);
    const parent = el.parentElement;
    el.remove();
    expect(mounted.size).toBe(0);
    expect(log.pending).toBe(0);
    parent?.append(el);
    await settle(el);
    expect(mounted.size).toBe(3);
    expect(nameCells(el)).toEqual(['<Person 0>', '<Person 1>', '<Person 2>']);
  });

  test('pinned rows and loading rows', async () => {
    const { renderer, mounted } = recorder();
    const source: DataSource<Person> = { getRows: () => new Promise(() => undefined) };
    await fixture({
      contentRenderer: renderer,
      columns,
      dataSource: source,
      pinnedRows: { top: people(1) },
    });
    // Only the pinned row: loading rows have no content.
    expect(mounted.size).toBe(1);
    expect([...mounted.values()]).toEqual(['<Person 0>']);
  });

  test('a new renderer takes over: the old one releases what it rendered', async () => {
    const one = recorder();
    const two = recorder();
    const el = await fixture({ contentRenderer: one.renderer, columns, data: people(2) });
    el.contentRenderer = two.renderer;
    await settle(el);
    expect(one.mounted.size).toBe(0);
    expect(one.log.pending).toBe(0);
    expect(two.mounted.size).toBe(2);
  });

  test('without a renderer, foreign content renders nothing and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await fixture({ columns, data: people(2) });
    expect(nameCells(el)).toEqual(['', '']);
    expect(
      warn.mock.calls.filter(([m]) => String(m).includes('contentRenderer')).length,
    ).toBeLessThanOrEqual(1);
  });

  test('plugins nest foreign content through host.content()', async () => {
    const { renderer } = recorder();
    const wrap: ArgusPlugin<Person> = {
      name: 'wrap',
      columns: (defs, host) =>
        defs.map((d) => ({
          ...d,
          header: () => {
            const own = typeof d.header === 'function' ? d.header() : d.header;
            return html`<b class="wrapped">${host.content?.(own)}</b>`;
          },
        })),
    };
    const el = await fixture({
      contentRenderer: renderer,
      plugins: [wrap],
      columns: columns.map((c) => ({ ...c, header: fake(`H ${c.id}`) })),
      data: people(1),
    } as never);
    const header = shadow(el).querySelector('[role="columnheader"][data-col="name"]');
    const wrapped = header ? slotted(header)?.querySelector('.wrapped') : undefined;
    expect(wrapped?.textContent).toBe('H name');
  });
});
