import { html } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ArgusTable } from './argus-table.js';
import { setMaxElementHeightForTests } from './max-height.js';
import type {
  ArgusPlugin,
  CellClickDetail,
  ColumnDef,
  PluginHost,
  RowClickDetail,
  RowDetailContext,
  TreeExpandedChangeDetail,
} from './index.js';
import { chevronPointing, fixture, rowText, rowsInOrder, settle, shadow } from './test-utils.js';

interface Item {
  name: string;
  kids?: Item[];
}

/** `count` parents with three children each: `P0` with `C0.0`, `C0.1`, `C0.2`, and so on. */
function tree(count = 3): Item[] {
  return Array.from({ length: count }, (_, p) => ({
    name: `P${String(p)}`,
    kids: [0, 1, 2].map((c) => ({ name: `C${String(p)}.${String(c)}` })),
  }));
}

const columns: ColumnDef<Item>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 200 },
  { id: 'size', header: 'Size', accessor: (r) => r.name.length, width: 100 },
];

const getSubRows = (r: Item) => r.kids;

function treeTable(props: Partial<ArgusTable<Item>> = {}, count = 3) {
  return fixture<Item>({ columns, data: tree(count), getSubRows, ...props });
}

/** The first cell's text of each body row, in row order. */
const names = (el: HTMLElement) => rowsInOrder(el).map((r) => rowText(r)[0]);

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

/** The body row showing `name` in a cell. */
function rowOf(el: HTMLElement, name: string): HTMLElement {
  const row = rowsInOrder(el).find((r) => rowText(r).includes(name));
  if (!row) throw new Error(`no row ${name}`);
  return row;
}

afterEach(() => {
  setMaxElementHeightForTests(undefined);
  document.body.replaceChildren();
});

describe('tree rows: properties', () => {
  test('shows children of expanded rows', async () => {
    const el = await treeTable();
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
    el.treeExpanded = ['0'];
    await settle(el);
    expect(names(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
  });

  test('reads flat data with getParentId', async () => {
    const flat = [
      { id: 'a', name: 'A', parent: null },
      { id: 'b', name: 'B', parent: 'a' },
      { id: 'c', name: 'C', parent: null },
    ];
    const el = await fixture({
      columns: [{ id: 'name', header: 'Name', accessor: 'name' }],
      data: flat,
      getRowId: (r) => r.id,
      getParentId: (r) => r.parent,
    });
    expect(names(el)).toEqual(['A', 'C']);
    el.treeExpanded = ['a'];
    await settle(el);
    expect(names(el)).toEqual(['A', 'B', 'C']);
  });

  test('scrollToRow by id skips rows under collapsed parents', async () => {
    const el = await treeTable({}, 50);
    await expect(el.scrollToRow({ id: '40.1' })).resolves.toBe(false);
    expect(scroller(el).scrollTop).toBe(0);

    el.treeExpanded = ['40'];
    await settle(el);
    await expect(el.scrollToRow({ id: '40.1' })).resolves.toBe(true);
    expect(scroller(el).scrollTop).toBeGreaterThan(0);
  });
});

describe('tree rows: saved state', () => {
  test('getState and setState carry treeExpanded', async () => {
    const controlled = await treeTable({ treeExpanded: ['0'] });
    expect(controlled.getState().treeExpanded).toEqual(['0']);
    // A controlled value is the host's to set.
    await controlled.setState({ treeExpanded: ['1'] });
    expect(controlled.treeExpanded).toEqual(['0']);
    controlled.remove();

    const el = await treeTable({}, 50);
    expect(el.getState().treeExpanded).toEqual([]);
    const seen: unknown[] = [];
    el.addEventListener('argus-tree-expanded-change', (e) => {
      seen.push(e.detail);
    });
    // The scroll row counts the rows shown once `treeExpanded` applies: 44 is C40.0
    // (P0, P1, C1.0–C1.2, P2–P40).
    await el.setState({ treeExpanded: ['1', '40'], scroll: { row: 44, inline: 0 } });
    await settle(el);
    expect(el.treeExpanded).toEqual(['1', '40']);
    expect(el.getState().scroll.row).toBe(44);
    expect(topRowText(el)).toBe('C40.0');
    expect(seen).toEqual([]);

    await el.setState({ scroll: { row: 0, inline: 0 } });
    await settle(el);
    expect(names(el).slice(0, 6)).toEqual(['P0', 'P1', 'C1.0', 'C1.1', 'C1.2', 'P2']);
  });
});

describe('tree rows: role', () => {
  test('the host is a treegrid with a tree', async () => {
    const el = await treeTable();
    expect(el.getAttribute('role')).toBe('treegrid');
    el.getSubRows = undefined;
    await settle(el);
    expect(el.getAttribute('role')).toBe('grid');
    el.getSubRows = getSubRows;
    await settle(el);
    expect(el.getAttribute('role')).toBe('treegrid');
  });

  test('a role the page set stays', async () => {
    const el = document.createElement('argus-table') as unknown as ArgusTable<Item>;
    el.setAttribute('role', 'grid');
    Object.assign(el, { columns, data: tree(), getSubRows });
    el.style.inlineSize = '800px';
    el.style.blockSize = '400px';
    document.body.append(el);
    await settle(el);
    expect(el.getAttribute('role')).toBe('grid');
    // Also when the tree goes and comes back.
    el.getSubRows = undefined;
    await settle(el);
    expect(el.getAttribute('role')).toBe('grid');
    el.getSubRows = getSubRows;
    await settle(el);
    expect(el.getAttribute('role')).toBe('grid');
  });
});

describe('tree rows: contexts', () => {
  test('cell clicks carry depth', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    const seen: CellClickDetail<unknown>[] = [];
    el.addEventListener('argus-cell-click', (e) => {
      seen.push(e.detail);
    });
    rowOf(el, 'C0.1').querySelector<HTMLElement>('[part~="cell"]')?.click();
    rowOf(el, 'P1').querySelector<HTMLElement>('[part~="cell"]')?.click();
    expect(seen.map((d) => [d.rowId, d.depth])).toEqual([
      ['0.1', 1],
      ['1', 0],
    ]);

    el.getSubRows = undefined;
    await settle(el);
    rowOf(el, 'P1').querySelector<HTMLElement>('[part~="cell"]')?.click();
    expect(seen[2]?.rowId).toBe('1');
    expect(seen[2] && 'depth' in seen[2]).toBe(false);
  });

  test('row clicks carry depth', async () => {
    const el = await treeTable({
      treeExpanded: ['0'],
      pinnedRows: { top: [{ name: 'Pinned' }] },
    });
    const seen: RowClickDetail<unknown>[] = [];
    el.addEventListener('argus-row-click', (e) => {
      seen.push(e.detail);
    });
    rowOf(el, 'C0.1').querySelector<HTMLElement>('[part~="cell"]')?.click();
    rowOf(el, 'P1').querySelector<HTMLElement>('[part~="cell"]')?.click();
    expect(seen.map((d) => [d.rowId, d.depth])).toEqual([
      ['0.1', 1],
      ['1', 0],
    ]);
    // Pinned rows aren't in the tree.
    shadow(el).querySelector<HTMLElement>('[part~="row-pinned"] [part~="cell"]')?.click();
    expect(seen[2]?.pinned).toBe('top');
    expect(seen[2] && 'depth' in seen[2]).toBe(false);

    el.getSubRows = undefined;
    await settle(el);
    rowOf(el, 'P1').querySelector<HTMLElement>('[part~="cell"]')?.click();
    expect(seen[3]?.rowId).toBe('1');
    expect(seen[3] && 'depth' in seen[3]).toBe(false);
  });

  test('rowDetail gets depth', async () => {
    const seen: RowDetailContext<Item>[] = [];
    const el = await treeTable({
      treeExpanded: ['0'],
      expanded: ['0.1'],
      rowDetail: (context) => {
        seen.push(context);
        return html`<p>Details of ${context.row.name}</p>`;
      },
    });
    const child = seen.find((c) => c.rowId === '0.1');
    expect(child?.depth).toBe(1);
    expect(child?.index).toBe(2);
    expect(el.expanded).toEqual(['0.1']);
  });

  test('rowDetail gets no depth without a tree', async () => {
    const seen: RowDetailContext<Item>[] = [];
    await fixture<Item>({
      columns,
      data: tree(),
      expanded: ['1'],
      rowDetail: (context) => {
        seen.push(context);
        return html`<p>Details of ${context.row.name}</p>`;
      },
    });
    const panel = seen.find((c) => c.rowId === '1');
    expect(panel).toBeDefined();
    expect(panel && 'depth' in panel).toBe(false);
  });
});

describe('tree rows: plugin host', () => {
  test('plugins read depth and source rows', async () => {
    let host: PluginHost<Item> | undefined;
    const plugin: ArgusPlugin<Item> = {
      name: 'grab',
      connect(h) {
        host = h;
      },
    };
    const data = tree();
    const el = await fixture<Item>({
      columns,
      data,
      getSubRows,
      treeExpanded: ['0'],
      plugins: [plugin],
    });
    if (!host) throw new Error('no host');
    expect(host.rowDepth(0)).toBe(0);
    expect(host.rowDepth(1)).toBe(1);
    expect(host.rowDepth(4)).toBe(0);
    expect(host.rowDepth(99)).toBe(0);
    // Source indexes: `data`'s, then the nested children depth-first from `data.length`.
    expect(host.sourceRow(1)).toBe(data[1]);
    expect(host.sourceRow(3)).toBe(data[0]?.kids?.[0]);
    expect(host.sourceRow(11)).toBe(data[2]?.kids?.[2]);
    expect(host.sourceRow(12)).toBeUndefined();
    // Rows under collapsed rows are data, not view.
    expect(host.filteredIndexes()).toEqual(Array.from({ length: 12 }, (_, i) => i));

    el.getSubRows = undefined;
    el.pinnedRows = { top: [{ name: 'Top' }] };
    await settle(el);
    expect(host.rowDepth(1)).toBe(0);
    expect(host.rowDepth(0, 'top')).toBe(0);
    expect(host.sourceRow(1)).toBe(data[1]);
    expect(host.sourceRow(3)).toBeUndefined();
  });
});

/** The tree toggle in the body row showing `name`, or `null`. */
const toggleIn = (el: HTMLElement, name: string) =>
  rowOf(el, name).querySelector<HTMLButtonElement>('[part~="tree-toggle"]');

function toggleOf(el: HTMLElement, name: string): HTMLButtonElement {
  const button = toggleIn(el, name);
  if (!button) throw new Error(`no toggle in ${name}`);
  return button;
}

/** The details of `name` events `el` fires. */
function events<D>(el: HTMLElement, name: string): D[] {
  const seen: D[] = [];
  el.addEventListener(name, (event) => {
    seen.push((event as CustomEvent<D>).detail);
  });
  return seen;
}

/** The cell of column `col` in the body row showing `name`. */
function cellOf(el: HTMLElement, name: string, col: string): HTMLElement {
  const cell = rowOf(el, name).querySelector<HTMLElement>(`[data-col="${col}"]`);
  if (!cell) throw new Error(`no ${col} cell in ${name}`);
  return cell;
}

/** Where a cell's slotted content starts, in px from the viewport's left. */
const contentLeft = (cell: Element) =>
  cell.querySelector('slot')?.assignedElements()[0]?.getBoundingClientRect().left ?? NaN;

describe('tree rows: the tree column', () => {
  test('rows carry aria-level, aria-expanded, aria-setsize and aria-posinset', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    const p0 = rowOf(el, 'P0');
    expect(p0.getAttribute('aria-level')).toBe('1');
    expect(p0.getAttribute('aria-expanded')).toBe('true');
    expect(p0.getAttribute('aria-setsize')).toBe('3');
    expect(p0.getAttribute('aria-posinset')).toBe('1');
    const c01 = rowOf(el, 'C0.1');
    expect(c01.getAttribute('aria-level')).toBe('2');
    expect(c01.getAttribute('aria-setsize')).toBe('3');
    expect(c01.getAttribute('aria-posinset')).toBe('2');
    expect(c01.hasAttribute('aria-expanded')).toBe(false);
    const p2 = rowOf(el, 'P2');
    expect(p2.getAttribute('aria-expanded')).toBe('false');
    expect(p2.getAttribute('aria-posinset')).toBe('3');

    el.getSubRows = undefined;
    await settle(el);
    const flat = rowOf(el, 'P0');
    for (const name of ['aria-level', 'aria-expanded', 'aria-setsize', 'aria-posinset']) {
      expect(flat.hasAttribute(name)).toBe(false);
    }
    expect(shadow(el).querySelector('[part~="tree-toggle"]')).toBeNull();
  });

  test('only rows with children get a toggle, in the first data column', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    const toggles = () => [...shadow(el).querySelectorAll<HTMLElement>('[part~="tree-toggle"]')];
    expect(toggles()).toHaveLength(3);
    expect(toggleIn(el, 'C0.0')).toBeNull();
    for (const t of toggles())
      expect(t.closest('[role="gridcell"]')?.getAttribute('data-col')).toBe('name');
    const p0 = toggleOf(el, 'P0');
    expect(p0.type).toBe('button');
    expect(p0.tabIndex).toBe(-1);
    expect(p0.getAttribute('aria-expanded')).toBe('true');

    el.columnOrder = ['size', 'name'];
    await settle(el);
    expect(toggles()).toHaveLength(3);
    for (const t of toggles())
      expect(t.closest('[role="gridcell"]')?.getAttribute('data-col')).toBe('size');

    el.columnOrder = ['name', 'size'];
    el.selectionMode = 'multi';
    el.selectionCheckboxes = true;
    await settle(el);
    expect(toggles()).toHaveLength(3);
    for (const t of toggles())
      expect(t.closest('[role="gridcell"]')?.getAttribute('data-col')).toBe('name');
  });

  test('the indent grows with depth', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    el.style.setProperty('--argus-tree-indent', '20px');
    await settle(el);
    const indent = (name: string) =>
      cellOf(el, name, 'name').querySelector('.tree-indent')?.getBoundingClientRect().width;
    expect(indent('P0')).toBe(0);
    expect(indent('C0.0')).toBe(20);
    // A leaf's content lines up with where its parent's would be one level in.
    expect(contentLeft(cellOf(el, 'C0.0', 'name')) - contentLeft(cellOf(el, 'P0', 'name'))).toBe(
      20,
    );
  });

  test('the toggle toggles, and does nothing else', async () => {
    const el = await treeTable({ selectionMode: 'multi' });
    const seen: { detail: TreeExpandedChangeDetail; shown: (string | undefined)[] }[] = [];
    el.addEventListener('argus-tree-expanded-change', (e) => {
      seen.push({ detail: e.detail, shown: names(el) });
    });
    const cellClicks = events(el, 'argus-cell-click');
    const rowClicks = events(el, 'argus-row-click');
    // A real pointer click: press, focus, click. Uncontrolled, the event fires
    // after the update that applied it (`shown`).
    await userEvent.click(toggleOf(el, 'P0'));
    await settle(el);
    expect(names(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
    expect(seen).toEqual([
      {
        detail: { treeExpanded: ['0'], rowId: '0', open: true },
        shown: ['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2'],
      },
    ]);
    expect(el.treeExpanded).toEqual(['0']);
    expect(cellClicks).toEqual([]);
    expect(rowClicks).toEqual([]);
    expect(el.selection).toEqual([]);
    // Focus is on the toggle's cell.
    const cell = cellOf(el, 'P0', 'name');
    expect(shadow(el).activeElement).toBe(cell);
    expect(cell.tabIndex).toBe(0);
    expect(toggleOf(el, 'P0').getAttribute('aria-expanded')).toBe('true');
    expect(toggleOf(el, 'P0').getAttribute('aria-label')).toBe('Collapse row');

    toggleOf(el, 'P0').click();
    await settle(el);
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
    expect(seen.map((s) => s.detail)).toEqual([
      { treeExpanded: ['0'], rowId: '0', open: true },
      { treeExpanded: [], rowId: '0', open: false },
    ]);
    expect(toggleOf(el, 'P0').getAttribute('aria-label')).toBe('Expand row');
  });

  test('the toggle points toward the row end while collapsed, down while expanded', async () => {
    for (const dir of ['ltr', 'rtl']) {
      const el = await treeTable({ dir, treeExpanded: ['1'] });
      expect(chevronPointing(toggleOf(el, 'P0'))).toBe('end');
      expect(chevronPointing(toggleOf(el, 'P1'))).toBe('down');
      el.remove();
    }
  });

  test('a centred tree column keeps its toggles at the start', async () => {
    const data: Item[] = [
      { name: 'A', kids: [{ name: 'A1' }] },
      { name: 'A rather longer name', kids: [{ name: 'B1 with more text' }] },
    ];
    const el = await fixture<Item>({
      columns: [{ id: 'name', header: 'Name', accessor: 'name', width: 300, align: 'center' }],
      data,
      getSubRows,
      treeExpanded: ['0', '1'],
    });
    const left = (e: Element | null | undefined) => e?.getBoundingClientRect().left ?? NaN;
    const short = cellOf(el, 'A', 'name');
    const long = cellOf(el, 'A rather longer name', 'name');
    expect(left(short.querySelector('[part~="tree-toggle"]'))).toBe(
      left(long.querySelector('[part~="tree-toggle"]')),
    );
    expect(left(cellOf(el, 'A1', 'name').querySelector('.tree-spacer'))).toBe(
      left(cellOf(el, 'B1 with more text', 'name').querySelector('.tree-spacer')),
    );
    // The content is centred in the space after the toggle.
    const content = short.querySelector('slot')?.assignedElements()[0]?.getBoundingClientRect();
    const toggle = short.querySelector('[part~="tree-toggle"]')?.getBoundingClientRect();
    const cell = short.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(short).paddingInlineEnd);
    const gap = parseFloat(getComputedStyle(short).fontSize) * 0.25;
    if (!content || !toggle) throw new Error('no content or toggle');
    expect(content.left - toggle.right - gap).toBeCloseTo(cell.right - pad - content.right, 0);
  });

  test('a toggle press keeps the click from cancelling', async () => {
    const el = await treeTable();
    const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    toggleOf(el, 'P1').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    await settle(el);
    expect(el.treeExpanded).toEqual(['1']);
  });

  test('a row a filter keeps open has a disabled toggle', async () => {
    const el = await treeTable();
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    el.quickFilter = 'C0.1';
    await settle(el);
    expect(names(el)).toEqual(['P0', 'C0.1']);
    const toggle = toggleOf(el, 'P0');
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(toggle.getAttribute('part')).toBe('tree-toggle tree-toggle-disabled');
    // Still a button with its name, on an expanded row.
    expect(toggle.hasAttribute('disabled')).toBe(false);
    expect(toggle.getAttribute('aria-label')).toBe('Collapse row');
    expect(rowOf(el, 'P0').getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await settle(el);
    expect(seen).toEqual([]);
    expect(el.treeExpanded).toEqual([]);
    expect(names(el)).toEqual(['P0', 'C0.1']);

    // Also when the row is in `treeExpanded`.
    el.treeExpanded = ['0'];
    await settle(el);
    expect(toggleOf(el, 'P0').getAttribute('aria-disabled')).toBe('true');
    toggleOf(el, 'P0').click();
    await settle(el);
    expect(seen).toEqual([]);
    expect(el.treeExpanded).toEqual(['0']);

    el.quickFilter = '';
    await settle(el);
    expect(names(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
    expect(toggleOf(el, 'P0').hasAttribute('aria-disabled')).toBe(false);
    expect(toggleOf(el, 'P1').hasAttribute('aria-disabled')).toBe(false);
    expect(toggleOf(el, 'P0').getAttribute('part')).toBe('tree-toggle');
    toggleOf(el, 'P0').click();
    await settle(el);
    expect(seen).toEqual([{ treeExpanded: [], rowId: '0', open: false }]);
  });

  test('controlled: the toggle proposes and changes nothing', async () => {
    const el = await treeTable({ treeExpanded: [] });
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    toggleOf(el, 'P0').click();
    // Right away, with the proposed ids.
    expect(seen).toEqual([{ treeExpanded: ['0'], rowId: '0', open: true }]);
    await settle(el);
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
    expect(el.treeExpanded).toEqual([]);
    expect(seen).toHaveLength(1);
  });

  test('a row with empty children, or children all filtered out, has no toggle', async () => {
    const data: Item[] = [...tree(2), { name: 'Q', kids: [] }];
    const el = await fixture<Item>({ columns, data, getSubRows: (r) => r.kids ?? [] });
    expect(toggleIn(el, 'Q')).toBeNull();
    expect(rowOf(el, 'Q').hasAttribute('aria-expanded')).toBe(false);
    expect(rowOf(el, 'Q').getAttribute('aria-level')).toBe('1');
    // Its content lines up with that of a row with a toggle.
    expect(contentLeft(cellOf(el, 'Q', 'name'))).toBe(contentLeft(cellOf(el, 'P0', 'name')));
    // Right moves right, as on any cell.
    cellOf(el, 'Q', 'name').focus();
    await settle(el);
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect(shadow(el).activeElement).toBe(cellOf(el, 'Q', 'size'));
    expect(el.treeExpanded).toEqual([]);

    // P1 matches, none of its children do.
    el.quickFilter = 'P1';
    await settle(el);
    expect(names(el)).toEqual(['P1']);
    expect(toggleIn(el, 'P1')).toBeNull();
    expect(rowOf(el, 'P1').hasAttribute('aria-expanded')).toBe(false);
  });

  test('child rows work with detail panels', async () => {
    const el = await treeTable({
      treeExpanded: ['0'],
      expanded: ['0.1'],
      rowDetail: ({ row }) => html`<p>Details of ${row.name}</p>`,
    });
    const child = rowOf(el, 'C0.1');
    const at = Number(child.getAttribute('aria-rowindex'));
    const panel = shadow(el).querySelector(`[part~="row-detail"]`);
    expect(panel?.getAttribute('aria-rowindex')).toBe(String(at + 1));
    // The tree toggle is in the first data column, after the chevrons.
    expect(toggleOf(el, 'P0').closest('[role="gridcell"]')?.getAttribute('data-col')).toBe('name');
    expect(child.querySelector('[part~="expand-toggle"]')?.getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  test('child rows work with column virtualization', async () => {
    const wide: ColumnDef<Item>[] = [
      { id: 'name', header: 'Name', accessor: 'name', width: 100 },
      ...Array.from({ length: 59 }, (_, i): ColumnDef<Item> => ({
        id: `c${String(i)}`,
        header: `C${String(i)}`,
        accessor: (r) => `${r.name}·${String(i)}`,
        width: 100,
      })),
    ];
    const el = await fixture<Item>({
      columns: wide,
      data: tree(),
      getSubRows,
      treeExpanded: ['0'],
      virtualizeColumns: true,
    });
    const toggles = () => shadow(el).querySelectorAll('[part~="tree-toggle"]');
    expect(toggles()).toHaveLength(3);
    const s = scroller(el);
    const scrollInline = async (left: number) => {
      const scrolled = new Promise((resolve) => {
        s.addEventListener('scroll', resolve, { once: true });
      });
      s.scrollLeft = left;
      await scrolled;
      await settle(el);
    };
    await scrollInline(s.scrollWidth);
    // The active cell's column stays rendered: move it off the tree column.
    shadow(el).querySelector<HTMLElement>('[role="columnheader"][data-col="c58"]')?.focus();
    await settle(el);
    expect(shadow(el).querySelector('[part~="body"] [data-col="name"]')).toBeNull();
    // The tree column stays the first data column, not the first rendered one.
    expect(toggles()).toHaveLength(0);
    expect(shadow(el).querySelector('.tree-indent')).toBeNull();
    await scrollInline(0);
    expect(toggles()).toHaveLength(3);
    expect(toggleOf(el, 'P0').closest('[role="gridcell"]')?.getAttribute('data-col')).toBe('name');
  });

  test("the toggle's name follows labels", async () => {
    const el = await treeTable({
      treeExpanded: ['1'],
      labels: { expandTreeRow: 'Auf', collapseTreeRow: 'Zu' },
    });
    expect(toggleOf(el, 'P0').getAttribute('aria-label')).toBe('Auf');
    expect(toggleOf(el, 'P1').getAttribute('aria-label')).toBe('Zu');
  });
});

describe('tree rows: keys and focus', () => {
  /** The cell holding focus in the table's shadow root. */
  const focused = (el: HTMLElement) => shadow(el).activeElement;

  async function focusCell(el: ArgusTable<Item>, name: string, col: string) {
    cellOf(el, name, col).focus();
    await settle(el);
  }

  /** Real key presses on whatever has focus. */
  async function press(el: ArgusTable<Item>, keys: string) {
    await userEvent.keyboard(keys);
    await settle(el);
  }

  test('Right expands a collapsed parent and keeps focus', async () => {
    const el = await treeTable();
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    await focusCell(el, 'P0', 'name');
    await press(el, '{ArrowRight}');
    expect(names(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
    expect(seen).toEqual([{ treeExpanded: ['0'], rowId: '0', open: true }]);
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
  });

  test('Right on an expanded row or a leaf moves right', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    await focusCell(el, 'P0', 'name');
    await press(el, '{ArrowRight}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'size'));
    await focusCell(el, 'C0.1', 'name');
    await press(el, '{ArrowRight}');
    expect(focused(el)).toBe(cellOf(el, 'C0.1', 'size'));
    expect(seen).toEqual([]);
  });

  test('Left collapses an expanded row', async () => {
    const el = await treeTable();
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    await focusCell(el, 'P1', 'name');
    await press(el, '{ArrowRight}');
    await press(el, '{ArrowLeft}');
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
    expect(seen).toEqual([
      { treeExpanded: ['1'], rowId: '1', open: true },
      { treeExpanded: [], rowId: '1', open: false },
    ]);
    expect(focused(el)).toBe(cellOf(el, 'P1', 'name'));
  });

  test("Left on a child moves to its parent's tree cell", async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    await focusCell(el, 'C0.1', 'name');
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    expect(seen).toEqual([]);
    expect(names(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
  });

  test('Left on a child far from its parent brings the parent into view', async () => {
    const data: Item[] = [
      { name: 'Big', kids: Array.from({ length: 60 }, (_, i) => ({ name: `K${String(i)}` })) },
      { name: 'Next' },
    ];
    const el = await fixture<Item>({ columns, data, getSubRows, treeExpanded: ['0'] });
    await el.scrollToRow({ id: '0.59' });
    await settle(el);
    await focusCell(el, 'K59', 'name');
    await press(el, '{ArrowLeft}');
    await settle(el);
    expect(focused(el)).toBe(cellOf(el, 'Big', 'name'));
    expect(topRowText(el)).toBe('Big');
  });

  test('Left on a child far from its parent in a scaled body brings the parent into view', async () => {
    // 3000 rows of about 40 px past a 100k px cap: the body is scaled.
    setMaxElementHeightForTests(100_000);
    const data: Item[] = [
      { name: 'Big', kids: Array.from({ length: 3000 }, (_, i) => ({ name: `K${String(i)}` })) },
      { name: 'Next' },
    ];
    const el = await fixture<Item>({ columns, data, getSubRows, treeExpanded: ['0'] });
    await el.scrollToRow({ id: '0.2999' });
    await settle(el);
    expect(topRowText(el)).not.toBe('Big');
    await focusCell(el, 'K2999', 'name');
    await press(el, '{ArrowLeft}');
    await settle(el);
    expect(focused(el)).toBe(cellOf(el, 'Big', 'name'));
    expect(topRowText(el)).toBe('Big');
  });

  test('Left on a collapsed top-level row moves left as before', async () => {
    const plain = await treeTable();
    const seen = events<TreeExpandedChangeDetail>(plain, 'argus-tree-expanded-change');
    await focusCell(plain, 'P1', 'name');
    await press(plain, '{ArrowLeft}');
    expect(focused(plain)).toBe(cellOf(plain, 'P1', 'name'));
    expect(seen).toEqual([]);
    plain.remove();

    const el = await treeTable({ selectionMode: 'multi', selectionCheckboxes: true });
    await focusCell(el, 'P1', 'name');
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'P1', '--argus-selection'));
    expect(el.treeExpanded).toEqual([]);
  });

  test('RTL swaps the arrows', async () => {
    const el = await treeTable({ dir: 'rtl' });
    await focusCell(el, 'P0', 'name');
    await press(el, '{ArrowLeft}');
    expect(names(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    await press(el, '{ArrowRight}');
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    expect(el.treeExpanded).toEqual([]);
    // Toward the end is a move once the row is open.
    await press(el, '{ArrowLeft}');
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'size'));
  });

  test('keys off the tree column behave as before', async () => {
    const three: ColumnDef<Item>[] = [
      ...columns,
      { id: 'kind', header: 'Kind', accessor: (r) => (r.kids ? 'parent' : 'leaf'), width: 100 },
    ];
    const el = await treeTable({ columns: three });
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    await focusCell(el, 'P0', 'size');
    await press(el, '{ArrowRight}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'kind'));
    await press(el, '{ArrowLeft}');
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    // Header cells and modified keys too.
    await press(el, '{Shift>}{ArrowRight}{/Shift}');
    shadow(el).querySelector<HTMLElement>('[role="columnheader"][data-col="name"]')?.focus();
    await settle(el);
    await press(el, '{ArrowRight}');
    expect(focused(el)?.getAttribute('data-col')).toBe('size');
    expect(seen).toEqual([]);
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
  });

  test('a row a filter keeps open is left alone; Left on its match goes to it', async () => {
    const el = await treeTable();
    const seen = events<TreeExpandedChangeDetail>(el, 'argus-tree-expanded-change');
    el.quickFilter = 'C0.1';
    await settle(el);
    expect(names(el)).toEqual(['P0', 'C0.1']);
    await focusCell(el, 'P0', 'name');
    // Top-level and kept open: Left moves left as before (nothing to its left).
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    expect(names(el)).toEqual(['P0', 'C0.1']);
    await focusCell(el, 'C0.1', 'name');
    await press(el, '{ArrowLeft}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    // Open: Right moves right.
    await press(el, '{ArrowRight}');
    expect(focused(el)).toBe(cellOf(el, 'P0', 'size'));
    expect(seen).toEqual([]);
    expect(el.treeExpanded).toEqual([]);
  });

  test('Enter on a tree cell still does what a click does', async () => {
    const el = await treeTable();
    const clicks = events<CellClickDetail<Item>>(el, 'argus-cell-click');
    await focusCell(el, 'P0', 'name');
    await press(el, '{Enter}');
    expect(clicks.map((c) => [c.rowId, c.columnId])).toEqual([['0', 'name']]);
    expect(el.treeExpanded).toEqual([]);
    expect(names(el)).toEqual(['P0', 'P1', 'P2']);
  });

  describe('with detail panels open', () => {
    const detail: Partial<ArgusTable<Item>> = {
      expanded: ['0', '0.0'],
      rowDetail: ({ row }) => html`<p>Details of ${row.name}</p>`,
    };
    /** The names in row order: the chevron column comes first. */
    const shownNames = (el: HTMLElement) => rowsInOrder(el).map((r) => rowText(r)[1]);
    /** The `aria-rowindex` of the row holding the focused cell. */
    const focusedRow = (el: HTMLElement) =>
      focused(el)?.parentElement?.getAttribute('aria-rowindex');
    /** The panel cell under the body row showing `name`. */
    const panelOf = (el: HTMLElement, name: string) => {
      const at = Number(rowOf(el, name).getAttribute('aria-rowindex')) + 1;
      const cell = shadow(el).querySelector<HTMLElement>(
        `[aria-rowindex="${String(at)}"] > [data-col="--argus-detail"]`,
      );
      if (!cell) throw new Error(`no panel under ${name}`);
      return cell;
    };

    test("Left on a child goes to its parent's tree cell over the panels", async () => {
      const el = await treeTable({ ...detail, treeExpanded: ['0'] });
      expect(shownNames(el)).toEqual(['P0', 'C0.0', 'C0.1', 'C0.2', 'P1', 'P2']);
      await focusCell(el, 'C0.1', 'name');
      await press(el, '{ArrowLeft}');
      expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
      expect(focusedRow(el)).toBe(rowOf(el, 'P0').getAttribute('aria-rowindex'));
    });

    test("by keys, from a child's panel: Up, Left to the parent, Left again", async () => {
      const el = await treeTable(detail);
      await focusCell(el, 'P0', 'name');
      await press(el, '{ArrowRight}');
      expect(el.treeExpanded).toEqual(['0']);
      panelOf(el, 'C0.0').focus();
      await settle(el);
      await press(el, '{ArrowUp}{ArrowLeft}{ArrowLeft}');
      expect(shownNames(el)).toEqual(['P0', 'P1', 'P2']);
      expect(el.treeExpanded).toEqual([]);
      expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
      expect(focusedRow(el)).toBe(rowOf(el, 'P0').getAttribute('aria-rowindex'));
    });

    test("by a controlled host, from a child's panel", async () => {
      const el = await treeTable({ ...detail, treeExpanded: ['0'] });
      await focusCell(el, 'C0.0', 'size');
      await press(el, '{ArrowDown}');
      expect(focused(el)).toBe(panelOf(el, 'C0.0'));
      el.treeExpanded = [];
      await settle(el);
      expect(shownNames(el)).toEqual(['P0', 'P1', 'P2']);
      expect(document.activeElement).toBe(el);
      // On the row, in the column the active cell had before the panel.
      expect(focused(el)).toBe(cellOf(el, 'P0', 'size'));
      expect(focusedRow(el)).toBe(rowOf(el, 'P0').getAttribute('aria-rowindex'));
    });
  });

  test('a filter dropping the active child moves the active cell to its parent', async () => {
    const el = await treeTable({ treeExpanded: ['0'] });
    await focusCell(el, 'C0.1', 'size');
    el.quickFilter = 'C0.0';
    await settle(el);
    expect(names(el)).toEqual(['P0', 'C0.0']);
    expect(document.activeElement).toBe(el);
    expect(focused(el)).toBe(cellOf(el, 'P0', 'size'));
  });

  describe('collapsing moves the active cell from a descendant to the row', () => {
    test('by a click on the toggle', async () => {
      const el = await treeTable();
      await focusCell(el, 'P0', 'name');
      await press(el, '{ArrowRight}');
      await focusCell(el, 'C0.2', 'size');
      await userEvent.click(toggleOf(el, 'P0'));
      await settle(el);
      expect(names(el)).toEqual(['P0', 'P1', 'P2']);
      // The click puts focus on the toggle's cell.
      expect(document.activeElement).toBe(el);
      expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    });

    test('by keys: Left to the parent, Left again', async () => {
      const el = await treeTable();
      await focusCell(el, 'P0', 'name');
      await press(el, '{ArrowRight}');
      await focusCell(el, 'C0.2', 'name');
      await press(el, '{ArrowLeft}{ArrowLeft}');
      expect(names(el)).toEqual(['P0', 'P1', 'P2']);
      expect(focused(el)).toBe(cellOf(el, 'P0', 'name'));
    });

    test('by a controlled host, in the same column', async () => {
      const el = await treeTable({ treeExpanded: ['0', '1'] });
      await focusCell(el, 'C0.2', 'size');
      el.treeExpanded = [];
      await settle(el);
      expect(names(el)).toEqual(['P0', 'P1', 'P2']);
      expect(document.activeElement).toBe(el);
      expect(focused(el)).toBe(cellOf(el, 'P0', 'size'));
    });

    test('a deeper descendant goes to its nearest shown ancestor', async () => {
      const data: Item[] = [
        { name: 'A', kids: [{ name: 'A1', kids: [{ name: 'A1a' }, { name: 'A1b' }] }] },
        { name: 'B' },
      ];
      const el = await fixture<Item>({ columns, data, getSubRows, treeExpanded: ['0', '0.0'] });
      await focusCell(el, 'A1b', 'size');
      el.treeExpanded = ['0'];
      await settle(el);
      expect(focused(el)).toBe(cellOf(el, 'A1', 'size'));
      el.treeExpanded = [];
      await settle(el);
      expect(focused(el)).toBe(cellOf(el, 'A', 'size'));
    });

    test('without focus in the table, the tab stop moves and focus stays put', async () => {
      const outside = document.createElement('button');
      document.body.append(outside);
      const el = await treeTable({ treeExpanded: ['0'] });
      await focusCell(el, 'C0.2', 'size');
      outside.focus();
      el.treeExpanded = [];
      await settle(el);
      expect(document.activeElement).toBe(outside);
      expect(cellOf(el, 'P0', 'size').tabIndex).toBe(0);
    });
  });
});
