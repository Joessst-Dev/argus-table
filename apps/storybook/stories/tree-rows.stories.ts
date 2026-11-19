import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, ColumnDef, TreeExpandedChangeDetail } from 'argus-table';
import 'argus-table';

const meta = {
  title: 'Features/Tree rows',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** A file or folder: folders have children (`getSubRows`). */
interface Entry {
  name: string;
  size: number;
  children?: Entry[];
}

const file = (name: string, size: number): Entry => ({ name, size });
/** A folder is as large as what it holds. */
const folder = (name: string, children: Entry[]): Entry => ({
  name,
  size: children.reduce((sum, child) => sum + child.size, 0),
  children,
});

const files: Entry[] = [
  folder('src', [
    folder('components', [
      file('Button.tsx', 2_340),
      file('Table.tsx', 8_912),
      file('Toolbar.tsx', 1_208),
    ]),
    folder('lib', [file('api.ts', 3_105), file('format.ts', 640)]),
    file('main.ts', 412),
  ]),
  folder('public', [file('favicon.svg', 1_024), file('logo.png', 24_576)]),
  file('package.json', 1_150),
  file('README.md', 2_760),
];

const fileColumns: ColumnDef<Entry>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: { flex: 1 }, sortable: true },
  { id: 'size', header: 'Size', accessor: 'size', width: 120, align: 'end', sortable: true },
];
const subRows = (entry: Entry) => entry.children;

/** A person in an org chart: flat data, each row naming its manager (`getParentId`). */
interface Person {
  id: string;
  name: string;
  title: string;
  managerId: string | null;
}

const people: Person[] = [
  { id: 'p1', name: 'Grace Okafor', title: 'Chief executive', managerId: null },
  { id: 'p2', name: 'Bruno Silva', title: 'VP of Engineering', managerId: 'p1' },
  { id: 'p3', name: 'Hana Tanaka', title: 'VP of Design', managerId: 'p1' },
  { id: 'p4', name: 'Ines Moreau', title: 'Engineer', managerId: 'p2' },
  { id: 'p5', name: 'Jonas Fischer', title: 'Engineer', managerId: 'p2' },
  { id: 'p6', name: 'Kemi Mensah', title: 'Designer', managerId: 'p3' },
  { id: 'p7', name: 'Luca Rossi', title: 'Designer', managerId: 'p3' },
];

const personColumns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: { flex: 1 } },
  { id: 'title', header: 'Title', accessor: 'title', width: 200 },
];
const personId = (person: Person) => person.id;
const managerOf = (person: Person) => person.managerId;

/** Applies a toggle's proposal, for stories that start with rows expanded (`treeExpanded` set). */
const apply = (event: CustomEvent<TreeExpandedChangeDetail>) => {
  (event.currentTarget as ArgusTable).treeExpanded = event.detail.treeExpanded;
};

/** The table in a story, once it has rendered. */
async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable> {
  const table = canvasElement.querySelector<ArgusTable>('argus-table');
  if (!table) throw new Error('no <argus-table>');
  await table.updateComplete;
  return table;
}

/** The body row at an `aria-rowindex` (the header is 1). */
function rowAt(table: ArgusTable, ariaRowIndex: number): HTMLElement {
  const row = table.shadowRoot?.querySelector<HTMLElement>(
    `[part~="body"] > [aria-rowindex="${String(ariaRowIndex)}"]`,
  );
  if (!row) throw new Error(`no row ${String(ariaRowIndex)}`);
  return row;
}

/** A cell of the body row at an `aria-rowindex`. */
function cellAt(table: ArgusTable, ariaRowIndex: number, col: string): HTMLElement {
  const cell = rowAt(table, ariaRowIndex).querySelector<HTMLElement>(`[data-col="${col}"]`);
  if (!cell) throw new Error(`no ${col} cell in row ${String(ariaRowIndex)}`);
  return cell;
}

/** The text a body cell shows (its slotted light-DOM content). */
const textAt = (table: ArgusTable, ariaRowIndex: number, col: string) =>
  (cellAt(table, ariaRowIndex, col).querySelector('slot')?.assignedNodes({ flatten: true }) ?? [])
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();

/** The toggle of the body row at an `aria-rowindex`. */
function toggleAt(table: ArgusTable, ariaRowIndex: number): HTMLButtonElement {
  const button = rowAt(table, ariaRowIndex).querySelector<HTMLButtonElement>(
    '[part~="tree-toggle"]',
  );
  if (!button) throw new Error(`no toggle in row ${String(ariaRowIndex)}`);
  return button;
}

/**
 * Nested data: `getSubRows` returns a row's children, and `data` holds the
 * top-level rows. Rows with children get a toggle in the first data column,
 * each level indented by `--argus-tree-indent`. Click a toggle, or press
 * ArrowRight on a collapsed row's cell in that column, to expand it;
 * ArrowLeft collapses it, or goes to the parent row. Sorting sorts siblings
 * among themselves: children stay under their parent. Without `getRowId`, a
 * child's id is its parent's, a dot and its place among its siblings (`'0.1'`).
 */
export const Nested: Story = {
  render: () =>
    html`<argus-table
      aria-label="Files"
      style="block-size: 420px"
      .columns=${fileColumns}
      .data=${files}
      .getSubRows=${subRows}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const seen: TreeExpandedChangeDetail[] = [];
    table.addEventListener('argus-tree-expanded-change', (event) => {
      seen.push(event.detail);
    });
    await expect(table.getAttribute('role')).toBe('treegrid');
    await expect(rowAt(table, 2).getAttribute('aria-level')).toBe('1');
    await expect(rowAt(table, 2).getAttribute('aria-expanded')).toBe('false');
    // A file has no toggle and no aria-expanded.
    await expect(rowAt(table, 4).getAttribute('aria-expanded')).toBeNull();

    // A click on src's toggle expands it.
    await userEvent.click(toggleAt(table, 2));
    await waitFor(() => expect(table.treeExpanded).toEqual(['0']));
    await expect(seen).toEqual([{ treeExpanded: ['0'], rowId: '0', open: true }]);
    await expect(rowAt(table, 2).getAttribute('aria-expanded')).toBe('true');
    await expect(toggleAt(table, 2).getAttribute('aria-expanded')).toBe('true');
    await expect(textAt(table, 3, 'name')).toBe('components');
    await expect(rowAt(table, 3).getAttribute('aria-level')).toBe('2');

    // ArrowRight on components' name cell expands it: its files are a level deeper.
    cellAt(table, 3, 'name').focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(table.treeExpanded).toEqual(['0', '0.0']));
    await expect(rowAt(table, 3).getAttribute('aria-expanded')).toBe('true');
    await expect(textAt(table, 4, 'name')).toBe('Button.tsx');
    await expect(rowAt(table, 4).getAttribute('aria-level')).toBe('3');
    await expect(table.shadowRoot?.activeElement).toBe(cellAt(table, 3, 'name'));

    // ArrowLeft collapses it again.
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(table.treeExpanded).toEqual(['0']));
    await expect(textAt(table, 4, 'name')).toBe('lib');
  },
};

/**
 * Flat data: `getParentId` returns the id of a row's parent (a `getRowId` id),
 * and `data` holds every row. With `selectBranches`, in `multi` mode, ticking a
 * row ticks its whole branch, and a row with some of its branch selected shows
 * a part-ticked checkbox. A row's id is in `selection` only while its whole
 * branch is selected.
 */
export const BranchSelection: Story = {
  render: () =>
    html`<argus-table
      aria-label="People"
      style="block-size: 360px"
      selection-mode="multi"
      selection-checkboxes
      select-branches
      .columns=${personColumns}
      .data=${people}
      .getRowId=${personId}
      .getParentId=${managerOf}
      .treeExpanded=${['p1', 'p2', 'p3']}
      @argus-tree-expanded-change=${apply}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const box = (ariaRowIndex: number) => {
      const input = cellAt(table, ariaRowIndex, '--argus-selection').querySelector('input');
      if (!input) throw new Error(`no checkbox in row ${String(ariaRowIndex)}`);
      return input;
    };
    // Grace (2), Bruno (3) with Ines and Jonas, Hana (6) with Kemi and Luca.
    await expect(textAt(table, 6, 'name')).toBe('Hana Tanaka');
    await userEvent.click(box(6));
    await waitFor(() => expect([...table.selection].sort()).toEqual(['p3', 'p6', 'p7']));
    await expect(box(6).checked).toBe(true);
    await expect(box(7).checked).toBe(true);
    await expect(box(8).checked).toBe(true);
    // Grace has part of her branch selected: part-ticked.
    await expect(box(2).checked).toBe(false);
    await expect(box(2).indeterminate).toBe(true);
    // Unticking one designer takes Hana out too: her branch is no longer whole.
    await userEvent.click(box(8));
    await waitFor(() => expect(table.selection).toEqual(['p6']));
    await expect(box(6).indeterminate).toBe(true);
  },
};

/**
 * A filter keeps the rows that match with their ancestors, so a match always
 * shows in its place. The ancestors show expanded, whatever `treeExpanded`
 * says, and their toggles are disabled until the filter clears.
 */
export const Filtered: Story = {
  render: () =>
    html`<argus-table
      aria-label="Files"
      style="block-size: 360px"
      quick-filter="format"
      .columns=${fileColumns}
      .data=${files}
      .getSubRows=${subRows}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(textAt(table, 4, 'name')).toBe('format.ts'));
    await expect(textAt(table, 2, 'name')).toBe('src');
    await expect(textAt(table, 3, 'name')).toBe('lib');
    await expect(rowAt(table, 2).getAttribute('aria-expanded')).toBe('true');
    await expect(toggleAt(table, 3).getAttribute('aria-disabled')).toBe('true');
    await expect(table.treeExpanded).toEqual([]);
  },
};
