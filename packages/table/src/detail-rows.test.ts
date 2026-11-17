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

/** The details of `name` events `el` fires itself (not those bubbling out of a nested table). */
function events<D>(el: HTMLElement, name: string): D[] {
  const seen: D[] = [];
  el.addEventListener(name, (event) => {
    if (event.target === el) seen.push((event as CustomEvent<D>).detail);
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

/** Gives the panel's content (`detailTable`'s paragraph) a height, as an image loading would. */
function fill(el: ArgusTable<Person>, panelRow: Element, px: number): HTMLElement {
  const block = panelSlot(el, panelRow).querySelector<HTMLElement>('p');
  if (!block) throw new Error('no panel content');
  block.style.cssText = `block-size: ${String(px)}px; margin: 0`;
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
    fill(el, panel, 240);
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

  it('takes idle pool slots out of the layout', async () => {
    const el = await detailTable({ expanded: ['p1'] }, 300);
    await scrollTo(el, 3000);
    const idle = [...shadow(el).querySelectorAll<HTMLElement>('[part~="body"] > .row[hidden]')];
    expect(idle.length).toBeGreaterThan(0);
    for (const row of idle) expect(getComputedStyle(row).display).toBe('none');
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

describe('detail rows: keyboard, focus, selection and events', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

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

  /** The element holding focus inside the shadow root. */
  const focused = (el: ArgusTable<Person>) => shadow(el).activeElement as HTMLElement | null;

  /** `aria-rowindex` and column of the focused cell. */
  const where = (el: ArgusTable<Person>) => {
    const cell = focused(el);
    return cell
      ? [Number(cell.parentElement?.getAttribute('aria-rowindex')), cell.dataset.col]
      : undefined;
  };

  async function key(el: ArgusTable<Person>, name: string, init?: KeyboardEventInit) {
    const cell = focused(el);
    if (!cell) throw new Error('nothing focused');
    press(cell, name, init);
    await settle(el);
    await settle(el);
  }

  async function focusCell(el: ArgusTable<Person>, ariaRowIndex: number, col: string) {
    rowAt(el, ariaRowIndex).querySelector<HTMLElement>(`[data-col="${col}"]`)?.focus();
    await settle(el);
  }

  const formDetail: Partial<ArgusTable<Person>> = {
    rowDetail: ({ row }) =>
      html`<label>Note <input class="note" .value=${row.name} /></label
        ><button type="button">Save</button>`,
  };

  /** Whether the panel at an `aria-rowindex` holds the grid's tab stop (the active cell). */
  const panelIsActive = (el: ArgusTable<Person>, ariaRowIndex: number) =>
    rowAt(el, ariaRowIndex).querySelector('[part~="detail"]')?.getAttribute('tabindex') === '0';

  /** The light-DOM content of the panel under a row, by the panel's `aria-rowindex`. */
  const panelContent = (el: ArgusTable<Person>, ariaRowIndex: number) =>
    panelSlot(el, rowAt(el, ariaRowIndex));

  it('arrows down onto an open panel and on to the next row', async () => {
    const el = await detailTable({ expanded: ['p2'] });
    // Row 2 at aria-rowindex 4, its panel at 5, row 3 at 6.
    await focusCell(el, 4, 'name');
    await key(el, 'ArrowDown');
    expect(where(el)).toEqual([5, '--argus-detail']);
    await key(el, 'ArrowDown');
    expect(where(el)).toEqual([6, 'name']);
    await key(el, 'ArrowUp');
    await key(el, 'ArrowUp');
    expect(where(el)).toEqual([4, 'name']);
  });

  it('enters the panel with Enter or F2 and leaves it with Escape', async () => {
    const el = await detailTable({ ...formDetail, expanded: ['p2'] });
    await focusCell(el, 4, 'name');
    await key(el, 'ArrowDown');
    await key(el, 'Enter');
    const input = panelContent(el, 5).querySelector<HTMLInputElement>('input.note');
    expect(document.activeElement).toBe(input);
    if (!input) return;
    input.value = 'abc';
    press(input, 'Escape');
    await settle(el);
    expect(where(el)).toEqual([5, '--argus-detail']);
    expect(document.activeElement).toBe(el);
    await key(el, 'F2');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('abc');
  });

  it('leaves keys inside a panel to its content', async () => {
    const el = await detailTable({ ...formDetail, expanded: ['p2'], selectionMode: 'multi' });
    const changes = events(el, 'argus-selection-change');
    await focusCell(el, 4, 'name');
    await key(el, 'ArrowDown');
    await key(el, 'Enter');
    const input = panelContent(el, 5).querySelector<HTMLInputElement>('input.note');
    if (!input) throw new Error('no input');
    for (const name of ['ArrowDown', 'Home', 'Enter', ' ']) {
      const event = press(input, name);
      await settle(el);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(document.activeElement).toBe(input);
    expect(panelIsActive(el, 5)).toBe(true);
    expect(changes).toEqual([]);
  });

  it('keeps a nested table to itself', async () => {
    const inner = people(10);
    const el = await detailTable({
      expanded: ['p2'],
      selectionMode: 'multi',
      rowDetail: () =>
        html`<argus-table
          class="nested"
          style="block-size: 200px; inline-size: 400px"
          .columns=${columns}
          .data=${inner}
          .getRowId=${byId}
          selection-mode="multi"
        ></argus-table>`,
    });
    await settle(el);
    const nested = panelContent(el, 5).querySelector<ArgusTable<Person>>('argus-table.nested');
    if (!nested) throw new Error('no nested table');
    await settle(nested);
    const outerClicks = events<{ index: number }>(el, 'argus-row-click');
    const innerClicks = events<{ index: number }>(nested, 'argus-row-click');
    // Arrow keys in the nested table move its active cell, not the outer one.
    await focusCell(el, 4, 'name');
    const cell = shadow(nested).querySelector<HTMLElement>(
      '[part~="body"] > [role="row"][aria-rowindex="2"] > [data-col="name"]',
    );
    if (!cell) throw new Error('no nested cell');
    cell.focus();
    await settle(nested);
    press(cell, 'ArrowDown');
    await settle(nested);
    await settle(el);
    expect(shadow(nested).activeElement?.parentElement?.getAttribute('aria-rowindex')).toBe('3');
    expect(panelIsActive(el, 5)).toBe(true);
    // A click on a nested row fires the nested table's event only.
    const third = shadow(nested).querySelector<HTMLElement>(
      '[part~="body"] > [role="row"][aria-rowindex="4"] > [data-col="name"]',
    );
    third?.click();
    third?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }),
    );
    await settle(el);
    expect(innerClicks.map((d) => d.index)).toEqual([2, 2]);
    expect(outerClicks).toEqual([]);
    expect(el.selection).toEqual([]);
    expect(nested.selection).toEqual(['p2']);
  });

  it('fires no events and selects nothing for clicks inside a panel', async () => {
    const el = await detailTable({ ...formDetail, expanded: ['p2'], selectionMode: 'multi' });
    const clicks = events(el, 'argus-cell-click');
    const rows = events(el, 'argus-row-click');
    rowAt(el, 5).querySelector<HTMLElement>('[part~="detail"]')?.click();
    panelContent(el, 5).querySelector<HTMLInputElement>('input.note')?.click();
    await settle(el);
    expect(clicks).toEqual([]);
    expect(rows).toEqual([]);
    expect(el.selection).toEqual([]);
  });

  it('steps over panels in selection ranges', async () => {
    const el = await detailTable({ expanded: ['p2'], selectionMode: 'multi' });
    // Row 1 at aria 3; row 2 at 4 with its panel at 5; row 3 at 6.
    await focusCell(el, 3, 'name');
    await key(el, ' ');
    await key(el, 'ArrowDown', { shiftKey: true });
    await key(el, 'ArrowDown', { shiftKey: true });
    expect(where(el)).toEqual([6, 'name']);
    expect([...el.selection].sort()).toEqual(['p1', 'p2', 'p3']);
    // Space on a panel selects nothing.
    await focusCell(el, 4, 'name');
    await key(el, 'ArrowDown');
    await key(el, ' ');
    expect([...el.selection].sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('counts panels as rows for PageDown and Ctrl+End', async () => {
    const el = await detailTable({ expanded: ['p1', 'p3'] }, 50);
    await focusCell(el, 2, 'name');
    await key(el, 'PageDown');
    const after = where(el);
    expect(after?.[0]).toBeGreaterThan(2);
    await key(el, 'End', { ctrlKey: true });
    // 50 rows and 2 panels: the last row is at aria-rowindex 53.
    expect(where(el)).toEqual([53, 'age']);
  });

  it('keeps a focused panel rendered while it scrolls away', async () => {
    const el = await detailTable({ ...formDetail, expanded: ['p2'] }, 300);
    await focusCell(el, 4, 'name');
    await key(el, 'ArrowDown');
    await key(el, 'Enter');
    const input = panelContent(el, 5).querySelector<HTMLInputElement>('input.note');
    if (!input) throw new Error('no input');
    await scrollTo(el, 5000);
    expect(rowAt(el, 5).isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    await scrollTo(el, 0);
    expect(panelContent(el, 5).querySelector('input.note')).toBe(input);
  });

  it('focusCell takes a data index', async () => {
    const el = await detailTable({
      expanded: ['p2'],
      plugins: [
        {
          name: 'focus',
          connect: (host) => {
            setTimeout(() => {
              host.focusCell(4, 'name');
            });
            return undefined;
          },
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle(el);
    // Data row 4 is at aria-rowindex 7: row 2's panel is above it.
    expect(where(el)).toEqual([7, 'name']);
  });
});

describe('detail rows: panel content', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  /** The visible panel rows' content, by `aria-rowindex`. */
  const contentAt = (el: ArgusTable<Person>, ariaRowIndex: number) =>
    panelSlot(el, rowAt(el, ariaRowIndex));

  it('renders rowDetail into the panel', async () => {
    const el = await detailTable({
      expanded: ['p2'],
      rowDetail: ({ row, index }) => html`<p>${row.name} at ${index}</p>`,
    });
    expect(contentAt(el, 5).textContent.trim()).toBe('Person 2 at 2');
    el.sorting = [{ id: 'name', desc: true }];
    el.columns = columns.map((c) => ({ ...c, sortable: true }));
    await settle(el);
    await settle(el);
    // By name, descending and naturally: Person 19, 18, …, 10, 9, …, 3, 2.
    const panel = panelRows(el)[0];
    if (!panel) throw new Error('no panel');
    expect(panelSlot(el, panel).textContent.trim()).toBe('Person 2 at 17');
  });

  it('keeps typed input while the panel scrolls away and back', async () => {
    const el = await detailTable(
      { expanded: ['p2'], rowDetail: () => html`<input class="note" />` },
      300,
    );
    const input = contentAt(el, 5).querySelector<HTMLInputElement>('input.note');
    if (!input) throw new Error('no input');
    input.value = 'typed';
    await scrollTo(el, 2000);
    expect(panelRows(el)).toHaveLength(0);
    await scrollTo(el, 0);
    const back = contentAt(el, 5).querySelector<HTMLInputElement>('input.note');
    expect(back).toBe(input);
    expect(back?.value).toBe('typed');
  });

  it("keeps a nested table's sort across updates", async () => {
    const lines = people(5);
    const el = await detailTable({
      expanded: ['p2'],
      rowDetail: () =>
        html`<argus-table
          class="nested"
          style="block-size: 200px; inline-size: 300px"
          .columns=${columns.map((c) => ({ ...c, sortable: true }))}
          .data=${lines}
        ></argus-table>`,
    });
    const nested = contentAt(el, 5).querySelector<ArgusTable<Person>>('argus-table.nested');
    if (!nested) throw new Error('no nested table');
    nested.sorting = [{ id: 'age', desc: true }];
    await settle(nested);
    // New row objects with the same ids.
    el.data = people(20).map((p) => ({ ...p }));
    await settle(el);
    await settle(el);
    expect(contentAt(el, 5).querySelector('argus-table.nested')).toBe(nested);
    expect(nested.sorting).toEqual([{ id: 'age', desc: true }]);
  });

  /** A content renderer that records what it rendered and released. */
  function recorder() {
    const rendered = new Set<HTMLElement>();
    const released: HTMLElement[] = [];
    return {
      rendered,
      released,
      renderer: {
        render: (target: HTMLElement) => {
          rendered.add(target);
          target.textContent = 'foreign';
        },
        release: (target: HTMLElement) => {
          released.push(target);
          target.textContent = '';
        },
      },
    };
  }

  it('releases framework content when a panel closes', async () => {
    const record = recorder();
    const el = await detailTable({
      expanded: ['p1', 'p3'],
      contentRenderer: record.renderer,
      // Not a string, node or template: it goes to the content renderer.
      rowDetail: () => ({ foreign: true }) as unknown as string,
    });
    expect(record.rendered.size).toBe(2);
    const [first] = record.rendered;
    el.expanded = ['p3'];
    await settle(el);
    expect(record.released).toHaveLength(1);
    expect(record.released[0]).toBe(first);
  });

  it('drops everything when rowDetail goes away', async () => {
    const record = recorder();
    const el = await detailTable({
      expanded: ['p1', 'p3'],
      contentRenderer: record.renderer,
      rowDetail: () => ({ foreign: true }) as unknown as string,
    });
    el.rowDetail = undefined;
    await settle(el);
    expect(shadow(el).querySelector('[part~="cell-expand"]')).toBeNull();
    expect(shadow(el).querySelector('[part~="row-detail"]')).toBeNull();
    expect(record.released).toHaveLength(2);
    expect(el.expanded).toEqual(['p1', 'p3']);
  });

  for (const dir of ['ltr', 'rtl'] as const) {
    it(`stays in view when scrolled sideways (${dir})`, async () => {
      const wide = Array.from({ length: 30 }, (_, i) => ({
        id: `c${String(i)}`,
        header: `C${String(i)}`,
        accessor: 'name',
        width: 120,
        pin: i < 2 ? ('start' as const) : undefined,
      }));
      const el = await detailTable({ columns: wide, expanded: ['p2'] });
      el.dir = dir;
      await settle(el);
      const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
      if (!scroller) throw new Error('no scroller');
      scroller.scrollLeft =
        ((scroller.scrollWidth - scroller.clientWidth) / 2) * (dir === 'rtl' ? -1 : 1);
      await settle(el);
      await settle(el);
      const rect = rowAt(el, 5).querySelector('[part~="detail"]')?.getBoundingClientRect();
      // The scroller's inner area, past its border and a scrollbar on the left.
      const inner = scroller.getBoundingClientRect().left + scroller.clientLeft;
      expect(rect?.width).toBeCloseTo(scroller.clientWidth, 0);
      expect(rect?.left).toBeCloseTo(inner, 0);
    });
  }

  it('spans every column with virtualizeColumns', async () => {
    const wide = Array.from({ length: 60 }, (_, i) => ({
      id: `c${String(i)}`,
      header: `C${String(i)}`,
      accessor: 'name',
      width: 100,
    }));
    const el = await detailTable({ columns: wide, virtualizeColumns: true, expanded: ['p2'] });
    const cell = rowAt(el, 5).querySelector('[part~="detail"]');
    // 60 columns and the toggle column.
    expect(cell?.getAttribute('aria-colspan')).toBe('61');
    const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    expect(cell?.getBoundingClientRect().width).toBeCloseTo(scroller?.clientWidth ?? 0, 0);
  });

  it('caps a panel at --argus-detail-max-height', async () => {
    const el = await detailTable({
      expanded: ['p2'],
      rowDetail: () => html`<div style="block-size: 1000px"></div>`,
    });
    const cell = () => rowAt(el, 5).querySelector<HTMLElement>('[part~="detail"]');
    await settle(el);
    expect(cell()?.getBoundingClientRect().height).toBeCloseTo(400, 0);
    expect((cell()?.scrollHeight ?? 0) > (cell()?.clientHeight ?? 0)).toBe(true);
    el.style.setProperty('--argus-detail-max-height', '200px');
    await settle(el);
    await settle(el);
    expect(cell()?.getBoundingClientRect().height).toBeCloseTo(200, 0);
  });
});
