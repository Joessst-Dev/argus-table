import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import { people, settle, shadow, type Person } from './test-utils.js';

const columns = [
  { id: 'name', header: 'Name', accessor: 'name' },
  { id: 'age', header: 'Age', accessor: 'age' },
];

/** A table sized by `style` alone: `fixture()` would give it a height. */
async function mount(count: number, style: string): Promise<ArgusTable<Person>> {
  const el = document.createElement('argus-table') as ArgusTable<Person>;
  el.columns = columns;
  el.data = people(count);
  el.style.cssText = `inline-size: 600px; ${style}`;
  document.body.append(el);
  await settle(el);
  await settle(el);
  return el;
}

const height = (el: Element) => el.getBoundingClientRect().height;

/** The height of one row, from a rendered body row. */
function rowPx(el: ArgusTable<Person>): number {
  const row = shadow(el).querySelector('[part~="body"] > [role="row"]');
  if (!row) throw new Error('no body row');
  return height(row);
}

const bodyRows = (el: ArgusTable<Person>) =>
  shadow(el).querySelectorAll('[part~="body"] > [role="row"]').length;

describe('fit to content', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('is as tall as its header and rows when block-size is auto', async () => {
    const el = await mount(3, 'block-size: auto; max-block-size: 360px');
    // The header row is a row tall too.
    expect(height(el)).toBeCloseTo(4 * rowPx(el), 0);
  });

  it('stops at max-block-size and virtualizes past it', async () => {
    const el = await mount(2000, 'block-size: auto; max-block-size: 360px');
    expect(height(el)).toBeCloseTo(360, 0);
    expect(bodyRows(el)).toBeLessThan(30);
  });

  it('grows and shrinks with the data', async () => {
    const el = await mount(3, 'block-size: auto; max-block-size: 360px');
    const row = rowPx(el);
    el.data = people(5);
    await settle(el);
    expect(height(el)).toBeCloseTo(6 * row, 0);
    el.data = people(1);
    await settle(el);
    expect(height(el)).toBeCloseTo(2 * row, 0);
  });

  it('caps a table without a maximum at the window height, and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await mount(2000, 'block-size: auto');
    expect(height(el)).toBeCloseTo(window.innerHeight, 0);
    expect(bodyRows(el)).toBeLessThan(window.innerHeight / 20);
    const capped = warn.mock.calls.filter(([message]) =>
      String(message).startsWith('argus-table: block-size is auto without a max-block-size'),
    );
    expect(capped).toHaveLength(1);
  });

  it('does not cap a table with an explicit height taller than its rows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await mount(3, 'block-size: 2000px');
    expect(height(el)).toBeCloseTo(2000, 0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('caps a table that was hidden when it first rendered, once it shows', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tab = document.createElement('div');
    tab.style.display = 'none';
    document.body.append(tab);
    const el = document.createElement('argus-table') as ArgusTable<Person>;
    el.columns = columns;
    el.data = people(2000);
    el.style.cssText = 'inline-size: 600px; block-size: auto';
    tab.append(el);
    await settle(el);
    // Capped before it renders rows, not after rendering every one of them.
    let most = 0;
    const observer = new MutationObserver(() => {
      most = Math.max(most, bodyRows(el));
    });
    observer.observe(shadow(el), { childList: true, subtree: true });
    tab.style.display = '';
    await settle(el);
    await settle(el);
    observer.disconnect();
    expect(height(el)).toBeCloseTo(window.innerHeight, 0);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(window.innerHeight / 20);
  });

  it('keeps the scroller as tall as the host with a percentage max-block-size', async () => {
    const box = document.createElement('div');
    box.style.blockSize = '800px';
    document.body.append(box);
    const el = document.createElement('argus-table') as ArgusTable<Person>;
    el.columns = columns;
    el.data = people(2000);
    el.style.cssText = 'inline-size: 600px; block-size: 600px; max-block-size: 90%';
    box.append(el);
    await settle(el);
    await settle(el);
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    expect(height(el)).toBeCloseTo(600, 0);
    expect(scroller?.getBoundingClientRect().height).toBeCloseTo(600, 0);
  });
});
