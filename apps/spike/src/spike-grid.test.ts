import { afterEach, describe, expect, test } from 'vitest';
import { makePeople } from './data.js';
import { SpikeGrid, type Keying, type Variant } from './spike-grid.js';

const people = makePeople(100_000);

afterEach(() => {
  document.body.replaceChildren();
});

async function mount(variant: Variant, keying: Keying = 'row'): Promise<SpikeGrid> {
  const el = document.createElement('spike-grid');
  el.style.height = '600px';
  el.variant = variant;
  el.keying = keying;
  el.rows = people;
  document.body.append(el);
  await el.updateComplete;
  // The virtualizer measures the scroll element after the first render.
  await new Promise((r) => requestAnimationFrame(r));
  await el.updateComplete;
  return el;
}

const scroller = (el: SpikeGrid) => {
  const s = el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
  if (!s) throw new Error('no scroller');
  return s;
};

async function scrollTo(el: SpikeGrid, top: number) {
  scroller(el).scrollTop = top;
  await new Promise((r) => requestAnimationFrame(r));
  await el.updateComplete;
}

describe.each<[Variant, Keying]>([
  ['shadow', 'row'],
  ['slotted', 'row'],
  ['shadow', 'pool'],
  ['slotted', 'pool'],
  ['shadow', 'sorted'],
  ['slotted', 'sorted'],
])('%s variant, %s keying', (variant, keying) => {
  test('renders a bounded window of 100k rows', async () => {
    const el = await mount(variant, keying);
    const rows = el.shadowRoot?.querySelectorAll('[role="row"]').length ?? 0;
    expect(rows).toBeGreaterThan(5);
    expect(rows).toBeLessThan(200);
  });

  test('pinned cells carry cell-pinned, with one edge per side', async () => {
    const el = await mount(variant, keying);
    const row = el.shadowRoot?.querySelector('.body > .row');
    expect(row?.querySelectorAll('[part~="cell-pinned"]').length).toBe(3);
    expect(row?.querySelectorAll('[part~="cell-pinned-edge"][data-pin="start"]').length).toBe(1);
    expect(row?.querySelectorAll('[part~="cell-pinned-edge"][data-pin="end"]').length).toBe(1);
  });

  test.each([50_000, 51_000, 7])(
    'content follows its row after a jump to row %i',
    async (target) => {
      const el = await mount(variant, keying);
      await scrollTo(el, 50_000 * 36);
      await scrollTo(el, target * 36);
      const rows = el.shadowRoot?.querySelectorAll<HTMLElement>('.body > .row') ?? [];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const expected = String(Number(row.getAttribute('aria-rowindex')) - 2);
        const cell = row.querySelector('[role="gridcell"]');
        const slot = cell?.querySelector('slot');
        const text = slot
          ? slot
              .assignedElements()
              .map((e) => e.textContent.trim())
              .join('')
          : cell?.textContent.trim();
        expect(text).toBe(expected);
      }
    },
  );
});

test('slotted light DOM stays bounded while scrolling', async () => {
  const el = await mount('slotted');
  const columns = 20;
  for (const top of [0, 10_000, 500_000, 2_000_000, 3_000_000]) {
    await scrollTo(el, top);
    expect(el.children.length).toBeLessThanOrEqual(el.poolSize * columns);
  }
  expect(el.poolSize).toBeLessThan(80);
});

test.each<Variant>(['shadow', 'slotted'])(
  '%s variant, sorted keying keeps body DOM in row order',
  async (variant) => {
    const el = await mount(variant, 'sorted');
    for (const top of [0, 36_000, 1_800_000, 900_000]) {
      await scrollTo(el, top);
      const indices = [...(el.shadowRoot?.querySelectorAll('.body > .row') ?? [])].map((r) =>
        Number(r.getAttribute('aria-rowindex')),
      );
      expect(indices.length).toBeGreaterThan(5);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  },
);
