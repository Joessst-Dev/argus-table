import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type { ExpandedChangeDetail } from './types.js';
import { setMaxElementHeightForTests } from './max-height.js';
import { fixture, people, scrollTo, settle, shadow, type Person } from './test-utils.js';

const columns = [
  { id: 'name', header: 'Name', accessor: 'name' },
  { id: 'age', header: 'Age', accessor: 'age' },
];

const byId = (p: Person) => p.id;

function detailTable(props: Partial<ArgusTable<Person>> = {}, count = 20) {
  return fixture({
    columns,
    data: people(count),
    getRowId: byId,
    rowDetail: ({ row }) => html`<p>Details of ${row.name}</p>`,
    ...props,
  });
}

/** The body row element showing data row `index` (no panels open above it). */
function rowAt(el: ArgusTable<Person>, ariaRowIndex: number): HTMLElement {
  const row = shadow(el).querySelector<HTMLElement>(
    `[part~="body"] > [role="row"][aria-rowindex="${String(ariaRowIndex)}"]`,
  );
  if (!row) throw new Error(`no row ${String(ariaRowIndex)}`);
  return row;
}

const toggleOf = (row: Element) => {
  const button = row.querySelector<HTMLButtonElement>('[part~="expand-toggle"]');
  if (!button) throw new Error('no chevron');
  return button;
};

function events<D>(el: HTMLElement, name: string): D[] {
  const seen: D[] = [];
  el.addEventListener(name, (event) => {
    seen.push((event as CustomEvent<D>).detail);
  });
  return seen;
}

describe('detail rows: the toggle column', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('adds the toggle column only with rowDetail', async () => {
    const plain = await fixture({ columns, data: people(5) });
    expect(shadow(plain).querySelector('[part~="cell-expand"]')).toBeNull();
    plain.remove();

    const el = await detailTable({ rowExpandable: (p) => p.age !== 1 }, 5);
    expect(shadow(el).querySelector('[part~="header-cell-expand"]')).not.toBeNull();
    const toggles = shadow(el).querySelectorAll('[part~="expand-toggle"]');
    // Row 1 (age 1) can't expand.
    expect(toggles).toHaveLength(4);
    const first = toggleOf(rowAt(el, 2));
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(first.getAttribute('aria-label')).toBe('Show details');
    expect(rowAt(el, 3).querySelector('[part~="cell-expand"]')).not.toBeNull();
    expect(rowAt(el, 3).querySelector('[part~="expand-toggle"]')).toBeNull();
  });

  it('toggles on a click and fires argus-expanded-change', async () => {
    const el = await detailTable();
    const seen = events<ExpandedChangeDetail>(el, 'argus-expanded-change');
    toggleOf(rowAt(el, 4)).click();
    await settle(el);
    expect(seen).toEqual([{ expanded: ['p2'], rowId: 'p2', open: true }]);
    expect(el.expanded).toEqual(['p2']);
    const row = shadow(el).querySelector('[part~="row-expanded"]');
    if (!row) throw new Error('no expanded row');
    expect(row.getAttribute('aria-rowindex')).toBe('4');
    const button = toggleOf(row);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Hide details');
    button.click();
    await settle(el);
    expect(seen.at(-1)).toEqual({ expanded: [], rowId: 'p2', open: false });
  });

  it('toggles with Enter and Space on the chevron cell', async () => {
    const el = await detailTable();
    const cell = rowAt(el, 2).querySelector<HTMLElement>('[part~="cell-expand"]');
    if (!cell) throw new Error('no chevron cell');
    cell.focus();
    cell.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    await settle(el);
    expect(el.expanded).toEqual(['p0']);
    const again = rowAt(el, 2).querySelector<HTMLElement>('[part~="cell-expand"]');
    again?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
    await settle(el);
    expect(el.expanded).toEqual([]);
  });

  it('only proposes when controlled', async () => {
    const el = await detailTable({ expanded: [] });
    const seen = events<ExpandedChangeDetail>(el, 'argus-expanded-change');
    toggleOf(rowAt(el, 3)).click();
    await settle(el);
    expect(seen).toEqual([{ expanded: ['p1'], rowId: 'p1', open: true }]);
    expect(el.expanded).toEqual([]);
  });

  it('saves and restores expanded', async () => {
    const el = await detailTable();
    const seen = events<ExpandedChangeDetail>(el, 'argus-expanded-change');
    expect(el.getState().expanded).toEqual([]);
    await el.setState({ expanded: ['p3'] });
    expect(el.expanded).toEqual(['p3']);
    expect(el.getState().expanded).toEqual(['p3']);
    expect(seen).toEqual([]);
  });

  it('fires no cell or row click from the chevron', async () => {
    const el = await detailTable({ selectionMode: 'multi' });
    const cellClicks = events(el, 'argus-cell-click');
    const rowClicks = events(el, 'argus-row-click');
    toggleOf(rowAt(el, 2)).click();
    await settle(el);
    expect(cellClicks).toEqual([]);
    expect(rowClicks).toEqual([]);
    expect(el.selection).toEqual([]);
  });

  it('translates the chevron', async () => {
    const el = await detailTable({ labels: { expandRow: 'Details anzeigen' } });
    expect(toggleOf(rowAt(el, 2)).getAttribute('aria-label')).toBe('Details anzeigen');
  });
});

/** The body row showing displayed position `position` (`aria-rowindex` is one past the header). */
const rowAtPosition = (el: ArgusTable<Person>, position: number) => rowAt(el, position + 2);

/** The light-DOM slot element of the panel in a panel row (`d-…`). */
function panelSlot(el: ArgusTable<Person>, panelRow: Element): HTMLElement {
  const name = panelRow.querySelector('slot')?.getAttribute('name');
  const slot = name ? el.querySelector<HTMLElement>(`:scope > [slot="${name}"]`) : null;
  if (!slot) throw new Error('no panel slot element');
  return slot;
}

/** Content of a given height in a panel, put there by hand: the panel's own content comes later. */
function fill(el: ArgusTable<Person>, panelRow: Element, px: number): HTMLElement {
  const block = document.createElement('div');
  block.style.blockSize = `${String(px)}px`;
  panelSlot(el, panelRow).replaceChildren(block);
  return block;
}

const panelRows = (el: ArgusTable<Person>) =>
  [...shadow(el).querySelectorAll<HTMLElement>('[part~="body"] > [part~="row-detail"]')].filter(
    (r) => !r.hidden,
  );

describe('detail rows: panel rows', () => {
  afterEach(() => {
    document.body.replaceChildren();
    setMaxElementHeightForTests(undefined);
  });

  it('renders a panel row after each open row', async () => {
    const el = await detailTable({ expanded: ['p1', 'p3'] });
    const panels = panelRows(el)
      .map((r) => Number(r.getAttribute('aria-rowindex')))
      .sort((a, b) => a - b);
    expect(panels).toEqual([4, 7]);
    for (const panel of panelRows(el)) {
      const cell = panel.querySelector('[part~="detail"]');
      expect(cell?.getAttribute('role')).toBe('gridcell');
      // Name and age, and the toggle column.
      expect(cell?.getAttribute('aria-colspan')).toBe('3');
    }
    // Row 3 (position 4) follows its own panel, at position 5.
    expect(rowAtPosition(el, 4).getAttribute('part')).toContain('row-expanded');
  });

  it('adds nothing without rowDetail', async () => {
    const el = await fixture({ columns, data: people(20), getRowId: byId, expanded: ['p1'] });
    expect(el.querySelector('[slot^="d-"]')).toBeNull();
    expect(shadow(el).querySelector('[part~="row-detail"]')).toBeNull();
    expect(Number(rowAt(el, 3).getAttribute('aria-rowindex'))).toBe(3);
  });

  it('keeps public indexes as data indexes', async () => {
    const el = await detailTable({ expanded: ['p1'] }, 200);
    const clicks = events<{ index: number; rowId: string }>(el, 'argus-cell-click');
    // Data row 3 is at position 4: the panel of row 1 is above it.
    rowAtPosition(el, 4).querySelector<HTMLElement>('[data-col="name"]')?.click();
    expect(clicks.map(({ index, rowId }) => [index, rowId])).toEqual([[3, 'p3']]);
    const ranges = events<{ first: number; last: number }>(el, 'argus-range-change');
    await expect(el.scrollToRow(10)).resolves.toBe(true);
    await settle(el);
    expect(el.getState().scroll.row).toBe(10);
    expect(ranges.at(-1)?.first).toBe(10);
  });

  it('measures panels with fixed row heights', async () => {
    const el = await detailTable({ expanded: ['p1'] });
    const [panel] = panelRows(el);
    if (!panel) throw new Error('no panel');
    fill(el, panel, 120);
    await settle(el);
    await settle(el);
    const next = rowAtPosition(el, 3).getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    expect(box.height).toBeGreaterThanOrEqual(120);
    expect(next.top).toBeCloseTo(box.bottom, 0);
  });

  it('keeps the rows in view in place when a panel above them grows', async () => {
    const el = await detailTable({ expanded: ['p5'] }, 300);
    const [panel] = panelRows(el);
    if (!panel) throw new Error('no panel');
    fill(el, panel, 40);
    await settle(el);
    // Data row 30 is at position 31.
    await el.scrollToRow(30);
    await settle(el);
    const before = rowAtPosition(el, 31).getBoundingClientRect().top;
    const block = panelSlot(el, panel).firstElementChild as HTMLElement;
    block.style.blockSize = '240px';
    await settle(el);
    await settle(el);
    expect(rowAtPosition(el, 31).getBoundingClientRect().top).toBeCloseTo(before, 0);
  });

  it('keeps the rows in view in place when a panel above them opens from code', async () => {
    const el = await detailTable({}, 300);
    await el.scrollToRow(30);
    await settle(el);
    const before = rowAtPosition(el, 30).getBoundingClientRect().top;
    el.expanded = ['p5'];
    await settle(el);
    await settle(el);
    expect(rowAtPosition(el, 31).getBoundingClientRect().top).toBeCloseTo(before, 0);
    expect(el.getState().scroll.row).toBe(30);
  });

  it('shows a panel once its row loads', async () => {
    const all = people(200);
    const el = await detailTable({
      data: [],
      expanded: ['p40'],
      dataSource: {
        pageSize: 20,
        getRows: async ({ start, end }) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { rows: all.slice(start, end), total: all.length };
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    await settle(el);
    expect(panelRows(el)).toHaveLength(0);
    await el.scrollToRow(35);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await settle(el);
    await settle(el);
    expect(panelRows(el)).toHaveLength(1);
    // Row 40 at position 40, its panel at 41.
    expect(panelRows(el)[0]?.getAttribute('aria-rowindex')).toBe('43');
    expect(el.getState().scroll.row).toBe(35);
  });

  it('never removes a pooled slot while scrolling', async () => {
    const data = people(500);
    const el = await detailTable(
      { data, expanded: data.filter((_, i) => i % 3 === 0).map((p) => p.id) },
      500,
    );
    const changes: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') changes.push(`slot of ${record.target.nodeName}`);
        for (const node of record.removedNodes) {
          if (node instanceof Element && node.hasAttribute('slot')) {
            changes.push(`removed ${String(node.getAttribute('slot'))}`);
          }
        }
      }
    });
    // Scroll once first, so both pools have every slot they need.
    await scrollTo(el, 2000);
    observer.observe(el, { childList: true, attributes: true, attributeFilter: ['slot'] });
    for (let top = 2040; top < 10_000; top += 40) await scrollTo(el, top);
    observer.disconnect();
    expect(changes).toEqual([]);
  });

  it('scrolls to the end of 1M rows with panels open', async () => {
    setMaxElementHeightForTests(2_000_000);
    const data = people(1_000_000);
    const el = await detailTable({
      data,
      expanded: Array.from({ length: 1000 }, (_, i) => `p${String(i * 1000)}`),
    });
    await expect(el.scrollToRow(999_999)).resolves.toBe(true);
    await settle(el);
    // 1,000 panels above it.
    expect(rowAtPosition(el, 999_999 + 1000).textContent).toBeDefined();
  });
});
