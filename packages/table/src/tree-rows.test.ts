import { html } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type {
  ArgusPlugin,
  CellClickDetail,
  ColumnDef,
  PluginHost,
  RowDetailContext,
} from './index.js';
import { fixture, rowText, rowsInOrder, settle, shadow } from './test-utils.js';

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

/** The body row showing `name` in its first cell. */
function rowOf(el: HTMLElement, name: string): HTMLElement {
  const row = rowsInOrder(el).find((r) => rowText(r)[0] === name);
  if (!row) throw new Error(`no row ${name}`);
  return row;
}

afterEach(() => {
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
