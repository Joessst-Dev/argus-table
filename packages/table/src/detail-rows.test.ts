import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type { ExpandedChangeDetail } from './types.js';
import { fixture, people, settle, shadow, type Person } from './test-utils.js';

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
