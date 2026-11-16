import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { html } from 'lit';
import 'argus-table';
import type { ArgusPlugin, ArgusTable, ColumnDef } from 'argus-table';
import {
  applyEdit,
  cellEditing,
  type CellEditDetail,
  type CellEditingOptions,
  type ColumnEditOptions,
} from './index.js';

interface Row {
  id: string;
  name: string;
  qty: number | null;
  status: string;
  locked?: boolean;
}

const rows = (): Row[] => [
  { id: 'a', name: 'Ann', qty: 3, status: 'open' },
  { id: 'b', name: 'Bob', qty: 10, status: 'done', locked: true },
  { id: 'c', name: 'Cid', qty: null, status: 'open' },
];

const columns: ColumnDef<Row>[] = [
  { id: 'id', header: 'Id', accessor: 'id', width: 60 },
  { id: 'name', header: 'Name', accessor: 'name', width: 140, meta: { edit: true } },
  {
    id: 'qty',
    header: 'Quantity',
    accessor: 'qty',
    width: 100,
    filter: 'number',
    meta: {
      edit: {
        editable: (row) => !row.locked,
        validate: (value) =>
          typeof value === 'number' && value < 0 ? 'No negative amounts' : undefined,
      },
    },
  },
  {
    id: 'status',
    header: 'Status',
    accessor: 'status',
    width: 120,
    meta: {
      edit: {
        editor: 'select',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' },
        ],
      },
    },
  },
];

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function settle<R>(el: ArgusTable<R>) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

/** A table whose app applies every edit, as the docs show; `edits` records them. */
async function fixture(
  options: CellEditingOptions = {},
  props: Partial<ArgusTable<Row>> = {},
  plugins: ArgusPlugin<Row>[] = [],
): Promise<{ el: ArgusTable<Row>; edits: CellEditDetail<Row>[] }> {
  const el = document.createElement('argus-table') as ArgusTable<Row>;
  Object.assign(
    el,
    {
      columns,
      data: rows(),
      getRowId: (r: Row) => r.id,
      plugins: [...plugins, cellEditing<Row>(options)],
    },
    props,
  );
  el.style.inlineSize = '600px';
  el.style.blockSize = '300px';
  const edits: CellEditDetail<Row>[] = [];
  el.addEventListener('argus-cell-edit', (event) => {
    const detail = event.detail as CellEditDetail<Row>;
    edits.push(detail);
    el.data = applyEdit(el.data, detail, el.columns);
  });
  document.body.append(el);
  await settle(el);
  return { el, edits };
}

/** The body cell of a row (from 0) and column: below the header and the top pinned rows. */
function cellOf<R>(el: ArgusTable<R>, row: number, col: string): HTMLElement {
  const rowIndex = 2 + (el.pinnedRows?.top?.length ?? 0) + row;
  const cell = el.shadowRoot?.querySelector<HTMLElement>(
    `[aria-rowindex="${String(rowIndex)}"] > [data-col="${col}"]`,
  );
  if (!cell) throw new Error(`no cell ${String(row)} ${col}`);
  return cell;
}

/** The text a cell shows. */
const textOf = (cell: HTMLElement) =>
  (cell.querySelector('slot')?.assignedElements()[0]?.textContent ?? '').trim();

const editor = (el: ArgusTable<Row>) =>
  el.querySelector<HTMLInputElement | HTMLSelectElement>('.argus-edit-input');

async function focusCell(el: ArgusTable<Row>, row: number, col: string) {
  cellOf(el, row, col).focus();
  await settle(el);
}

async function press(el: ArgusTable<Row>, keys: string) {
  await userEvent.keyboard(keys);
  await settle(el);
}

describe('cellEditing', () => {
  test('marks editable columns for assistive tech', async () => {
    const { el } = await fixture();
    expect(cellOf(el, 0, 'id').getAttribute('aria-readonly')).toBe('true');
    expect(cellOf(el, 0, 'name').hasAttribute('aria-readonly')).toBe(false);
  });

  test('Enter opens the editor with the value; Enter commits and moves down', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'name');
    await press(el, '{Enter}');
    const input = editor(el);
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(document.activeElement).toBe(input);
    expect(input?.value).toBe('Ann');
    expect(input?.getAttribute('aria-label')).toBe('Name, row 1');
    await press(el, 'Anna{Enter}');
    expect(editor(el)).toBeNull();
    expect(edits).toEqual([
      { row: rows()[0], rowId: 'a', index: 0, columnId: 'name', value: 'Anna', previous: 'Ann' },
    ]);
    expect(textOf(cellOf(el, 0, 'name'))).toBe('Anna');
    expect(el.shadowRoot?.activeElement).toBe(cellOf(el, 1, 'name'));
  });

  test('typing starts from the character; F2 keeps the value; Delete starts empty', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'name');
    await press(el, 'Z');
    expect(editor(el)?.value).toBe('Z');
    await press(el, 'oe{Enter}');
    expect(edits.at(-1)?.value).toBe('Zoe');
    await focusCell(el, 2, 'name');
    await press(el, '{F2}');
    expect(editor(el)?.value).toBe('Cid');
    await press(el, '{Escape}');
    await press(el, '{Delete}');
    expect(editor(el)?.value).toBe('');
  });

  test('Escape cancels: nothing fires and focus is back on the cell', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'name');
    await press(el, '{Enter}Xyz{Escape}');
    expect(editor(el)).toBeNull();
    expect(edits).toEqual([]);
    expect(textOf(cellOf(el, 0, 'name'))).toBe('Ann');
    expect(el.shadowRoot?.activeElement).toBe(cellOf(el, 0, 'name'));
  });

  test('Tab commits and moves to the next editable column; Shift+Tab back', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'name');
    await press(el, '{Enter}{Tab}');
    expect(edits).toEqual([]);
    expect(el.shadowRoot?.activeElement).toBe(cellOf(el, 0, 'qty'));
    await press(el, '7{Shift>}{Tab}{/Shift}');
    expect(edits.at(-1)).toMatchObject({ columnId: 'qty', value: 7, previous: 3 });
    expect(el.shadowRoot?.activeElement).toBe(cellOf(el, 0, 'name'));
  });

  test('the number editor parses numbers, a decimal comma and empty text', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'qty');
    await press(el, '{Enter}');
    expect(editor(el)?.getAttribute('inputmode')).toBe('decimal');
    await press(el, '{Control>}a{/Control}2,5{Enter}');
    expect(edits.at(-1)?.value).toBe(2.5);
    await focusCell(el, 0, 'qty');
    await press(el, '{Delete}{Enter}');
    expect(edits.at(-1)?.value).toBeNull();
  });

  test("a value that isn't a number, or fails validate, keeps the editor open", async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'qty');
    await press(el, '{Delete}abc{Enter}');
    const input = editor(el);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    const message = el.querySelector<HTMLElement>('.argus-edit-error');
    expect(message?.textContent).toBe('Enter a number');
    expect(input?.getAttribute('aria-describedby')).toBe(message?.id);
    expect(message?.matches(':popover-open')).toBe(true);
    await press(el, '{Control>}a{/Control}-1{Enter}');
    expect(el.querySelector('.argus-edit-error')?.textContent).toBe('No negative amounts');
    expect(edits).toEqual([]);
    await press(el, '{Control>}a{/Control}4{Enter}');
    expect(edits.at(-1)?.value).toBe(4);
    expect(el.querySelector('.argus-edit-error')).toBeNull();
  });

  test('a row that editable() turns down opens no editor and says why', async () => {
    const { el } = await fixture();
    await focusCell(el, 1, 'qty');
    await press(el, '{Enter}');
    expect(editor(el)).toBeNull();
    // The table's announcer writes the message after a short pause.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(document.querySelector('[data-argus-announcer]')?.textContent).toBe(
      "Quantity can't be edited in this row",
    );
  });

  test('the select editor commits the chosen option', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'status');
    await press(el, '{Enter}');
    const select = editor(el) as HTMLSelectElement;
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect([...select.options].map((o) => o.textContent.trim())).toEqual(['Open', 'Done']);
    expect(select.value).toBe('0');
    select.value = '1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await press(el, '{Enter}');
    expect(edits.at(-1)).toMatchObject({ columnId: 'status', value: 'done', previous: 'open' });
  });

  test('an unchanged value fires nothing', async () => {
    const { el, edits } = await fixture();
    await focusCell(el, 0, 'qty');
    await press(el, '{Enter}{Enter}');
    await focusCell(el, 0, 'name');
    await press(el, '{Enter}{Enter}');
    expect(edits).toEqual([]);
  });

  test('a double-click opens the editor; leaving it commits', async () => {
    const { el, edits } = await fixture();
    await userEvent.dblClick(cellOf(el, 2, 'name'));
    await settle(el);
    expect(document.activeElement).toBe(editor(el));
    await press(el, '{Control>}a{/Control}Cy');
    cellOf(el, 0, 'id').focus();
    await settle(el);
    expect(editor(el)).toBeNull();
    expect(edits.at(-1)).toMatchObject({ rowId: 'c', value: 'Cy' });
  });

  test("Enter on a column that isn't editable is still a click", async () => {
    const { el } = await fixture();
    const clicks = vi.fn();
    el.addEventListener('argus-cell-click', clicks);
    await focusCell(el, 0, 'id');
    await press(el, '{Enter}');
    expect(clicks).toHaveBeenCalledOnce();
    expect(editor(el)).toBeNull();
  });

  test('enterMoves: false stays; typeToEdit: false ignores characters', async () => {
    const { el } = await fixture({ enterMoves: false, typeToEdit: false });
    await focusCell(el, 0, 'name');
    await press(el, 'x');
    expect(editor(el)).toBeNull();
    await press(el, '{Enter}y{Enter}');
    expect(el.shadowRoot?.activeElement).toBe(cellOf(el, 0, 'name'));
  });

  test('pinned rows are edited too, with pinned in the detail', async () => {
    const total: Row = { id: 't', name: 'Total', qty: 13, status: 'open' };
    const { el, edits } = await fixture({}, { pinnedRows: { top: [total] } });
    // The pinned row is the grid's second row, after the header.
    const pinned = el.shadowRoot?.querySelector<HTMLElement>(
      '[aria-rowindex="2"] > [data-col="name"]',
    );
    pinned?.focus();
    await settle(el);
    await press(el, '{Enter}Sum{Enter}');
    expect(edits.at(-1)).toMatchObject({ rowId: 't', index: 0, value: 'Sum', pinned: 'top' });
  });

  test('formula columns are never editable', async () => {
    const formula: ColumnDef<Row> = {
      id: 'double',
      header: 'Double',
      formula: '[qty] * 2',
      meta: { edit: true },
    };
    const { el } = await fixture({}, { columns: [...columns, formula] });
    expect(cellOf(el, 0, 'double').getAttribute('aria-readonly')).toBe('true');
  });
});

describe('more editors', () => {
  interface Task {
    id: string;
    due: Date | null;
    day: string;
    done: boolean;
    note: string;
  }
  const tasks = (): Task[] => [
    { id: 'a', due: new Date(2026, 10, 16), day: '2026-11-16', done: false, note: 'x' },
    { id: 'b', due: null, day: '', done: true, note: 'y' },
  ];

  async function mount(cols: ColumnDef<Task>[], plugins = [cellEditing<Task>()]) {
    const el = document.createElement('argus-table') as ArgusTable<Task>;
    Object.assign(el, { columns: cols, data: tasks(), getRowId: (t: Task) => t.id, plugins });
    el.style.inlineSize = '600px';
    el.style.blockSize = '300px';
    const edits: CellEditDetail<Task>[] = [];
    el.addEventListener('argus-cell-edit', (event) => {
      const detail = event.detail as CellEditDetail<Task>;
      edits.push(detail);
      el.data = applyEdit(el.data, detail, el.columns);
    });
    document.body.append(el);
    await settle(el);
    return { el, edits };
  }
  const cell = cellOf<Task>;
  /** An element the test needs, or a failure. */
  const must = <E>(element: E | null | undefined): E => {
    if (!element) throw new Error('missing element');
    return element;
  };
  const done = settle<Task>;

  test('the date editor keeps a Date a Date and a string a string', async () => {
    const { el, edits } = await mount([
      { id: 'due', accessor: 'due', filter: 'date', meta: { edit: true } },
      { id: 'day', accessor: 'day', meta: { edit: { editor: 'date' } } },
    ]);
    cell(el, 0, 'due').focus();
    await done(el);
    await userEvent.keyboard('{Enter}');
    await done(el);
    const input = el.querySelector<HTMLInputElement>('.argus-edit-input');
    expect(input?.type).toBe('date');
    expect(input?.value).toBe('2026-11-16');
    if (input) {
      input.value = '2026-12-24';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await userEvent.keyboard('{Tab}');
    await done(el);
    expect(edits.at(-1)?.value).toEqual(new Date(2026, 11, 24));
    // Tab went on to `day`; Delete starts it empty.
    await userEvent.keyboard('{Delete}');
    await done(el);
    await userEvent.keyboard('{Enter}');
    await done(el);
    expect(edits.at(-1)).toMatchObject({ columnId: 'day', value: null, previous: '2026-11-16' });
  });

  test('a checkbox toggles with Space, Enter or a click, without an editing mode', async () => {
    const { el, edits } = await mount([
      { id: 'done', accessor: 'done', meta: { edit: { editor: 'checkbox' } } },
      { id: 'note', accessor: 'note' },
    ]);
    const box = (row: number) =>
      cell(el, row, 'done')
        .querySelector('slot')
        ?.assignedElements()[0]
        ?.querySelector<HTMLInputElement>('.argus-edit-check');
    expect(box(0)?.checked).toBe(false);
    expect(box(1)?.checked).toBe(true);
    cell(el, 0, 'done').focus();
    await done(el);
    await userEvent.keyboard(' ');
    await done(el);
    expect(edits.at(-1)).toMatchObject({ rowId: 'a', value: true, previous: false });
    expect(box(0)?.checked).toBe(true);
    expect(el.querySelector('.argus-edit-input')).toBeNull();
    await userEvent.click(must(box(1)));
    await done(el);
    expect(edits.at(-1)).toMatchObject({ rowId: 'b', value: false, previous: true });
    expect(box(1)?.checked).toBe(false);
  });

  test("a checkbox the app doesn't apply shows the table's value again", async () => {
    const el = document.createElement('argus-table') as ArgusTable<Task>;
    Object.assign(el, {
      columns: [{ id: 'done', accessor: 'done', meta: { edit: { editor: 'checkbox' } } }],
      data: tasks(),
      plugins: [cellEditing<Task>()],
    });
    el.style.inlineSize = '400px';
    el.style.blockSize = '200px';
    document.body.append(el);
    await done(el);
    const box = cell(el, 0, 'done')
      .querySelector('slot')
      ?.assignedElements()[0]
      ?.querySelector<HTMLInputElement>('.argus-edit-check');
    await userEvent.click(must(box));
    await done(el);
    expect(box?.checked).toBe(false);
  });

  test('a custom editor commits and cancels itself; leaving it cancels', async () => {
    const editor: ColumnEditOptions<Task>['editor'] = ({ value, label, commit, cancel }) =>
      html`<input
        class="custom"
        aria-label=${label}
        .value=${String(value)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value.toUpperCase());
          if (e.key === 'q') cancel();
        }}
      />`;
    const { el, edits } = await mount([
      { id: 'note', accessor: 'note', meta: { edit: { editor } } },
      { id: 'id', accessor: 'id' },
    ]);
    cell(el, 0, 'note').focus();
    await done(el);
    await userEvent.keyboard('{Enter}');
    await done(el);
    const input = el.querySelector<HTMLInputElement>('input.custom');
    expect(document.activeElement).toBe(input);
    expect(input?.getAttribute('aria-label')).toBe('note, row 1');
    await userEvent.keyboard('{End}yz{Enter}');
    await done(el);
    expect(edits.at(-1)).toMatchObject({ value: 'XYZ', previous: 'x' });
    expect(el.shadowRoot?.activeElement).toBe(cell(el, 0, 'note'));
    await userEvent.keyboard('{Enter}');
    await done(el);
    await userEvent.keyboard('{Escape}');
    await done(el);
    expect(el.querySelector('input.custom')).toBeNull();
    await userEvent.dblClick(cell(el, 1, 'note'));
    await done(el);
    cell(el, 0, 'id').focus();
    await done(el);
    expect(el.querySelector('input.custom')).toBeNull();
    expect(edits).toHaveLength(1);
  });
});

describe('applyEdit', () => {
  /** The first row (the lists here are never empty). */
  const first = <V>(list: readonly V[]): V => {
    const [item] = list;
    if (item === undefined) throw new Error('empty');
    return item;
  };
  const detail = (over: Partial<CellEditDetail<Row>>, data: Row[]): CellEditDetail<Row> => ({
    row: first(data),
    rowId: 'a',
    index: 0,
    columnId: 'name',
    value: 'Anna',
    previous: 'Ann',
    ...over,
  });

  test('replaces the row with a copy, along an accessor path', () => {
    interface Nested {
      id: string;
      address: { city: string; zip: string };
    }
    const data: Nested[] = [{ id: 'a', address: { city: 'X', zip: '1' } }];
    const cols: ColumnDef<Nested>[] = [{ id: 'city', accessor: 'address.city' }];
    const before = data[0];
    const next = applyEdit(
      data,
      { row: first(data), rowId: 'a', index: 0, columnId: 'city', value: 'Y', previous: 'X' },
      cols,
    );
    expect(next).not.toBe(data);
    expect(next[0]).toEqual({ id: 'a', address: { city: 'Y', zip: '1' } });
    expect(before).toEqual({ id: 'a', address: { city: 'X', zip: '1' } });
  });

  test('uses meta.edit.set for a function accessor, and throws without one', () => {
    const data = rows();
    const upper: ColumnDef<Row> = {
      id: 'upper',
      accessor: (r) => r.name.toUpperCase(),
      meta: { edit: { set: (row, value) => ({ ...row, name: String(value).toLowerCase() }) } },
    };
    const next = applyEdit(data, detail({ columnId: 'upper', value: 'ZED' }, data), [upper]);
    expect(next[0]?.name).toBe('zed');
    expect(() =>
      applyEdit(data, detail({ columnId: 'fn' }, data), [{ id: 'fn', accessor: (r) => r.id }]),
    ).toThrow(/meta.edit.set/);
  });

  test('a pinned row or a row not in data leaves the rows as they are', () => {
    const data = rows();
    expect(applyEdit(data, detail({ pinned: 'top' }, data), columns)).toEqual(data);
    const stranger = { ...data[0] } as Row;
    expect(applyEdit(data, detail({ row: stranger }, data), columns)).toEqual(data);
  });
});
