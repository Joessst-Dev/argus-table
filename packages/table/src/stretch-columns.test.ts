import { afterEach, describe, expect, it } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type { ColumnDef } from './types.js';
import { fixture, people, settle, shadow, type Person } from './test-utils.js';

const three: ColumnDef<Person>[] = [
  { id: 'a', header: 'A', accessor: 'name', width: 150 },
  { id: 'b', header: 'B', accessor: 'age', width: 150 },
  { id: 'c', header: 'C', accessor: 'id', width: 150 },
];

const headers = (el: ArgusTable<Person>) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"][data-col]'),
];
const widths = (el: ArgusTable<Person>) =>
  headers(el).map((h) => Math.round(h.getBoundingClientRect().width));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
function scrollerOf(el: ArgusTable<Person>): HTMLElement {
  const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!scroller) throw new Error('no scroller');
  return scroller;
}
/** A frame for the resize observer, then the update it asks for. */
async function resized(el: ArgusTable<Person>) {
  await new Promise(requestAnimationFrame);
  await settle(el);
}

/** Drags column `i`'s resize handle by `dx` px. */
async function drag(el: ArgusTable<Person>, i: number, dx: number) {
  const h = headers(el)[i]?.querySelector<HTMLElement>('[part~="resize-handle"]');
  if (!h) throw new Error(`no handle ${String(i)}`);
  const x = h.getBoundingClientRect().left + 4;
  const opts = { bubbles: true, composed: true, pointerId: 1, button: 0 };
  h.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x }));
  h.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x + dx / 2 }));
  await new Promise(requestAnimationFrame);
  h.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x + dx }));
  h.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: x + dx }));
  await settle(el);
}

async function stretched(props: Partial<ArgusTable<Person>> = {}, rows = 5) {
  const el = await fixture({ columns: three, data: people(rows), stretchColumns: true, ...props });
  await resized(el);
  return el;
}

describe('stretchColumns', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('fills the width with stretch-columns', async () => {
    const el = await stretched();
    const scroller = scrollerOf(el);
    expect(Math.abs(sum(widths(el)) - scroller.clientWidth)).toBeLessThanOrEqual(1);
    expect(widths(el).every((w) => w > 150)).toBe(true);
    expect(el.columnSizing).toEqual({});
  });

  it('takes the stretch-columns attribute', async () => {
    const el = await fixture({ columns: three, data: people(2) });
    el.setAttribute('stretch-columns', '');
    await settle(el);
    expect(el.stretchColumns).toBe(true);
    el.setAttribute('stretch-columns', 'false');
    await settle(el);
    expect(el.stretchColumns).toBe(false);
  });

  it("follows the table's width, back down to own widths, then scrolls", async () => {
    const el = await stretched();
    const changes: unknown[] = [];
    el.addEventListener('argus-column-sizing-change', (e) => changes.push(e.detail));
    el.style.inlineSize = '1000px';
    await resized(el);
    const scroller = scrollerOf(el);
    expect(Math.abs(sum(widths(el)) - scroller.clientWidth)).toBeLessThanOrEqual(1);
    el.style.inlineSize = '300px';
    await resized(el);
    expect(widths(el)).toEqual([150, 150, 150]);
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(changes).toEqual([]);
  });

  it('a dragged column lands at the pointer, the others share the rest', async () => {
    const el = await stretched();
    const changes: { width: number }[] = [];
    el.addEventListener('argus-column-sizing-change', (e) => changes.push(e.detail));
    const [a = 0] = widths(el);
    await drag(el, 0, -100);
    const after = widths(el);
    expect(Math.abs((after[0] ?? 0) - (a - 100))).toBeLessThanOrEqual(1);
    expect(Math.abs(sum(after) - scrollerOf(el).clientWidth)).toBeLessThanOrEqual(1);
    expect(el.columnSizing.a).toBe(after[0]);
    expect(changes.at(-1)?.width).toBe(after[0]);
  });

  it('narrowing the last column when all are resized keeps it narrow', async () => {
    const el = await stretched({ columnSizing: { a: 150, b: 150, c: 150 } });
    // Controlled: apply what the drag proposes.
    el.addEventListener('argus-column-sizing-change', (e) => {
      el.columnSizing = e.detail.columnSizing;
    });
    const before = widths(el);
    // The last column takes the free space.
    expect(before.slice(0, 2)).toEqual([150, 150]);
    await drag(el, 2, -100);
    await resized(el);
    const after = widths(el);
    expect(Math.abs((after[2] ?? 0) - ((before[2] ?? 0) - 100))).toBeLessThanOrEqual(1);
    // The one before it took the space instead.
    expect(after[1]).toBeGreaterThan(150);
    expect(Math.abs(sum(after) - scrollerOf(el).clientWidth)).toBeLessThanOrEqual(1);
  });

  it('Alt+Arrow starts from the rendered width', async () => {
    const el = await stretched();
    const b = headers(el)[1];
    const before = widths(el)[1] ?? 0;
    b?.focus();
    b?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        altKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await settle(el);
    expect(widths(el)[1]).toBe(before - 10);
  });

  it('shows no horizontal scrollbar once a vertical one appears', async () => {
    const el = await stretched({}, 100);
    const scroller = scrollerOf(el);
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
  });

  it('stretches once a table that was hidden shows', async () => {
    const box = document.createElement('div');
    box.style.display = 'none';
    document.body.append(box);
    const el = document.createElement('argus-table') as ArgusTable<Person>;
    Object.assign(el, { columns: three, data: people(3), stretchColumns: true });
    el.style.cssText = 'inline-size: 800px; block-size: 300px';
    box.append(el);
    await settle(el);
    box.style.display = '';
    await resized(el);
    await resized(el);
    expect(Math.abs(sum(widths(el)) - scrollerOf(el).clientWidth)).toBeLessThanOrEqual(1);
  });

  it('places virtualized columns at their stretched offsets', async () => {
    // Six of 100 px: narrower than the table, so they stretch.
    const six = [...three, ...three.map((c) => ({ ...c, id: `${c.id}2` }))].map((c) => ({
      ...c,
      width: 100,
    }));
    const el = await stretched({ columns: six, virtualizeColumns: true }, 3);
    const rects = headers(el)
      .map((h) => h.getBoundingClientRect())
      .sort((p, q) => p.left - q.left);
    for (let i = 1; i < rects.length; i++) {
      expect(Math.abs((rects[i]?.left ?? 0) - (rects[i - 1]?.right ?? 0))).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(sum(widths(el)) - scrollerOf(el).clientWidth)).toBeLessThanOrEqual(1);
  });

  it('goes back to own widths when turned off', async () => {
    const el = await stretched();
    el.stretchColumns = false;
    await settle(el);
    expect(widths(el)).toEqual([150, 150, 150]);
  });

  it('fills the width right to left', async () => {
    const el = await stretched({ dir: 'rtl' });
    expect(Math.abs(sum(widths(el)) - scrollerOf(el).clientWidth)).toBeLessThanOrEqual(1);
  });
});

describe('stretchColumns with pinned columns and resizes', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps end-pinned cells under their header when the table narrows', async () => {
    const cols: ColumnDef<Person>[] = [
      ...three,
      { id: 'end', header: 'End', accessor: 'id', width: 100, pin: 'end' },
    ];
    const el = await stretched({ columns: cols });
    el.style.inlineSize = '760px';
    await resized(el);
    await resized(el);
    const head = shadow(el)
      .querySelector('[part~="header-cell"][data-col="end"]')
      ?.getBoundingClientRect();
    const cell = shadow(el)
      .querySelector('[part~="body"] [data-col="end"]')
      ?.getBoundingClientRect();
    expect(Math.abs((cell?.left ?? 0) - (head?.left ?? 0))).toBeLessThanOrEqual(1);
  });

  it('keeps stretching a column whose resize the app rejected', async () => {
    const el = await stretched({ columnSizing: {} });
    const before = widths(el);
    await drag(el, 1, -100);
    // Anything else that updates the table (here, a forced update).
    el.requestUpdate();
    await settle(el);
    expect(widths(el)).toEqual(before);
  });

  it('a group resize over every column follows the pointer, with no filler among them', async () => {
    const el = await stretched({
      columnGroups: [{ id: 'all', header: 'All', columns: ['a', 'b', 'c'] }],
    });
    const group = shadow(el).querySelector<HTMLElement>('[data-resize-group]');
    if (!group) throw new Error('no group handle');
    const total = sum(widths(el));
    const x = group.getBoundingClientRect().left + 4;
    const opts = { bubbles: true, composed: true, pointerId: 1, button: 0 };
    group.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x }));
    group.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x - 50 }));
    await new Promise(requestAnimationFrame);
    group.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x - 100 }));
    group.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: x - 100 }));
    await settle(el);
    await resized(el);
    expect(Math.abs(sum(widths(el)) - (total - 100))).toBeLessThanOrEqual(2);
  });
});
