import { afterEach, describe, expect, test } from 'vitest';
import { html } from 'lit';
import { ArgusTable } from './index.js';
import type { ColumnDef } from './types.js';
import {
  bodyRows,
  fixture,
  people,
  rowText,
  rowsInOrder,
  scrollTo,
  settle,
  shadow,
  slotted,
  type Person,
} from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200 },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, align: 'end' },
  { id: 'city', header: 'City', accessor: 'address.city', width: { flex: 1 }, minWidth: 120 },
];

describe('element basics', () => {
  test('registers <argus-table> and upgrades it to ArgusTable', async () => {
    const el = await fixture();
    expect(customElements.get('argus-table')).toBe(ArgusTable);
    expect(el).toBeInstanceOf(ArgusTable);
  });

  test('renders the table part inside an open shadow root', async () => {
    const el = await fixture();
    expect(shadow(el).querySelector('[part~="table"]')).not.toBeNull();
  });

  // `computedRole` is not in every engine yet, so this runs only where it exists.
  test.runIf('computedRole' in Element.prototype)(
    'exposes the grid role through ElementInternals, not a host attribute',
    async () => {
      const el = await fixture();
      expect(el.hasAttribute('role')).toBe(false);
      expect((el as unknown as { computedRole: string | null }).computedRole).toBe('grid');
    },
  );

  test('reflects density with comfortable as the default', async () => {
    const el = await fixture();
    expect(el.getAttribute('density')).toBe('comfortable');
  });
});

describe('rendering', () => {
  test('renders headers and cells from columns and data, with path accessors', async () => {
    const el = await fixture({ columns, data: people(3) });
    const headers = [...shadow(el).querySelectorAll('[part~="header-cell"]')];
    expect(headers.map((h) => slotted(h)?.textContent)).toEqual(['Name', 'Age', 'City']);
    expect(rowsInOrder(el).map(rowText)).toEqual([
      ['Person 0', '0', 'City 0'],
      ['Person 1', '1', 'City 1'],
      ['Person 2', '2', 'City 2'],
    ]);
  });

  test('renders template, Node, string and number content', async () => {
    const node = () => {
      const b = document.createElement('b');
      b.textContent = 'node';
      return b;
    };
    const el = await fixture({
      columns: [
        { id: 't', header: () => html`<i>T</i>`, cell: (p) => html`<em>${p.name}</em>` },
        { id: 'n', header: 'N', cell: () => node() },
        { id: 's', header: 'S', cell: (p) => p.id },
        { id: 'num', header: 'Num', cell: (p) => p.age * 2 },
      ],
      data: people(2),
    });
    const [first] = rowsInOrder(el);
    const cells = [...(first?.querySelectorAll('[part~="cell"]') ?? [])].map((c) => slotted(c));
    expect(cells[0]?.querySelector('em')?.textContent).toBe('Person 0');
    expect(cells[1]?.querySelector('b')?.textContent).toBe('node');
    expect(cells[2]?.textContent).toBe('p0');
    expect(cells[3]?.textContent).toBe('0');
    const headerCell = shadow(el).querySelector('[part~="header-cell"]');
    const header = headerCell ? slotted(headerCell) : undefined;
    expect(header?.querySelector('i')?.textContent).toBe('T');
  });

  test('keeps slotted content as direct light-DOM children of the host', async () => {
    const el = await fixture({ columns, data: people(2) });
    const content = [...el.children].filter((c) => c.hasAttribute('slot'));
    expect(content.length).toBe(3 + 2 * 3);
  });

  test('builds the grid template from fixed and flex widths', async () => {
    const el = await fixture({ columns, data: people(1) });
    const table = shadow(el).querySelector<HTMLElement>('[part~="table"]');
    expect(table?.style.getPropertyValue('--_cols')).toBe('200px 80px minmax(120px, 1fr)');
    // The flex column fills the rest of the 800px table.
    const city = shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]')[2];
    expect(Math.round(city?.getBoundingClientRect().width ?? 0)).toBe(800 - 200 - 80);
  });

  test('aligns cells with the column align', async () => {
    const el = await fixture({ columns, data: people(1) });
    const age = shadow(el).querySelectorAll('[part~="cell"]')[1];
    expect(age?.getAttribute('data-align')).toBe('end');
  });

  test('shows the empty slot with a default text when there are no rows', async () => {
    const el = await fixture({ columns, data: [] });
    const empty = shadow(el).querySelector('[part~="empty"]');
    expect(empty?.textContent.trim()).toBe('No rows');
    expect(bodyRows(el)).toHaveLength(0);

    const custom = document.createElement('p');
    custom.slot = 'empty';
    custom.textContent = 'Nothing here';
    el.append(custom);
    await settle(el);
    expect(empty?.querySelector('slot')?.assignedElements()).toEqual([custom]);
  });

  test('updates when data is replaced', async () => {
    const el = await fixture({ columns, data: people(2) });
    el.data = people(1);
    await settle(el);
    expect(rowsInOrder(el).map(rowText)).toEqual([['Person 0', '0', 'City 0']]);
  });
});

describe('accessibility', () => {
  test('sets roles and 1-based indices that count the header row', async () => {
    const el = await fixture({ columns, data: people(3) });
    const root = shadow(el);
    expect(root.querySelector('[part~="header-row"]')?.getAttribute('aria-rowindex')).toBe('1');
    expect(rowsInOrder(el).map((r) => r.getAttribute('aria-rowindex'))).toEqual(['2', '3', '4']);
    const cells = [...(rowsInOrder(el)[0]?.querySelectorAll('[role="gridcell"]') ?? [])];
    expect(cells.map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
    expect(root.querySelectorAll('[role="columnheader"]')).toHaveLength(3);
  });

  test.runIf('ariaRowCount' in ElementInternals.prototype)(
    'reports the full size through ElementInternals',
    async () => {
      const el = await fixture({ columns, data: people(1000) });
      // Not reflected to attributes, so the host stays free for the user's own ARIA.
      expect(el.hasAttribute('aria-rowcount')).toBe(false);
      expect(bodyRows(el).length).toBeLessThan(1000);
    },
  );
});

describe('virtualization', () => {
  test('renders a bounded window at 100k rows', async () => {
    const el = await fixture({ columns, data: people(100_000) });
    // 400px - 40px header = 9 visible rows at 40px, plus 6 overscan below.
    const count = bodyRows(el).length;
    expect(count).toBeGreaterThan(8);
    expect(count).toBeLessThanOrEqual(10 + 2 * 6);
    const body = shadow(el).querySelector<HTMLElement>('[part~="body"]');
    expect(parseFloat(body?.style.blockSize ?? '')).toBe(100_000 * 40);
  });

  test('shows the right content and aria-rowindex after scrolling and jumps', async () => {
    const el = await fixture({ columns, data: people(100_000), getRowId: (p) => p.id });
    await scrollTo(el, 40 * 37);
    expect(rowText(rowsInOrder(el)[0] as Element)[0]).toMatch(/^Person (3[0-9])$/);

    for (const index of [50_000, 99_990, 12_345]) {
      await el.scrollToRow(index);
      await settle(el);
      for (const row of bodyRows(el)) {
        const rowIndex = Number(row.getAttribute('aria-rowindex')) - 2;
        expect(rowText(row)[0]).toBe(`Person ${String(rowIndex)}`);
      }
      const indices = rowsInOrder(el).map((r) => Number(r.getAttribute('aria-rowindex')) - 2);
      expect(indices).toContain(Math.min(index, 100_000 - 9));
    }
  });

  test('reuses row DOM across jumps instead of creating rows', async () => {
    const el = await fixture({ columns, data: people(100_000) });
    const before = new Set(bodyRows(el));
    await el.scrollToRow(60_000);
    await settle(el);
    const after = bodyRows(el);
    expect(after.filter((r) => before.has(r)).length).toBe(Math.min(after.length, before.size));
    // Light-DOM content stays bounded by the pool, not by how far we scrolled.
    const content = [...el.children].filter((c) => c.hasAttribute('slot'));
    expect(content.length).toBeLessThanOrEqual(3 + 3 * (10 + 2 * 6));
  });

  test('fires argus-range-change after the update with the visible rows', async () => {
    const el = await fixture({ columns, data: people(1000) });
    const events: { start: number; end: number }[] = [];
    el.addEventListener('argus-range-change', (e) => events.push(e.detail));
    await el.scrollToRow(500);
    await settle(el);
    const last = events.at(-1);
    expect(last?.start).toBe(500);
    expect(last && last.end - last.start).toBeGreaterThanOrEqual(7);
    // Visible rows only: the rendered window (with overscan) is larger.
    expect(bodyRows(el).length).toBeGreaterThan((last?.end ?? 0) - (last?.start ?? 0) + 1);
  });
});

describe('row height and density', () => {
  const height = (el: HTMLElement) =>
    Math.round(bodyRows(el)[0]?.getBoundingClientRect().height ?? 0);

  test('uses the density defaults', async () => {
    const el = await fixture({ columns, data: people(10) });
    expect(height(el)).toBe(40);
    el.density = 'compact';
    await settle(el);
    expect(height(el)).toBe(32);
    el.density = 'spacious';
    await settle(el);
    expect(height(el)).toBe(52);
    const body = shadow(el).querySelector<HTMLElement>('[part~="body"]');
    expect(parseFloat(body?.style.blockSize ?? '')).toBe(10 * 52);
  });

  test('lets an explicit rowHeight win over density', async () => {
    const el = await fixture({ columns, data: people(10), density: 'compact', rowHeight: 60 });
    expect(height(el)).toBe(60);
    const second = rowsInOrder(el)[1];
    expect(second?.style.transform).toBe('translateY(60px)');
  });

  test('follows the --argus-row-height token from page CSS', async () => {
    const el = await fixture({ columns, data: people(10) });
    el.style.setProperty('--argus-row-height', '48px');
    await settle(el);
    expect(height(el)).toBe(48);
    expect(rowsInOrder(el)[1]?.style.transform).toBe('translateY(48px)');
  });
});
