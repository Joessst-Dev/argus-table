import { afterEach, describe, expect, test, vi } from 'vitest';
import 'argus-table';
import type { ArgusTable, ColumnDef } from 'argus-table';
import { headerMenu } from '@argus-table/header-menu';
import { formulas, type FormulaColumnChangeDetail, type FormulaColumnDetail } from './index.js';

interface Row {
  id: string;
  price: number;
  qty: number;
}

const data: Row[] = [
  { id: 'a', price: 2, qty: 12 },
  { id: 'b', price: 0.5, qty: 4 },
  { id: 'c', price: 10, qty: 0 },
];

const columns: ColumnDef<Row>[] = [
  { id: 'id', header: 'Order', accessor: 'id', resizable: false },
  { id: 'price', header: 'Unit price', accessor: 'price' },
  { id: 'qty', header: 'Quantity', accessor: 'qty' },
  { id: 'total', header: 'Total', formula: '[Unit price] * [qty]' },
  { id: 'gross', header: 'Gross', formula: 'ROUND([Total] * 1.19, 2)' },
];

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function settle(el: ArgusTable<Row>) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

async function fixture(editing: 'edit' | 'view' | 'none' = 'edit'): Promise<ArgusTable<Row>> {
  const el = document.createElement('argus-table') as ArgusTable<Row>;
  Object.assign(el, {
    columns,
    data,
    getRowId: (r: Row) => r.id,
    // Without the pin and hide items: these tests are about the formula items.
    plugins: [formulas<Row>({ editing }), headerMenu<Row>({ pin: false, hide: false })],
  });
  el.style.inlineSize = '900px';
  el.style.blockSize = '300px';
  document.body.append(el);
  await settle(el);
  return el;
}

const headerOf = (el: ArgusTable<Row>, id: string) => {
  const h = el.shadowRoot?.querySelector<HTMLElement>(`[role="columnheader"][data-col="${id}"]`);
  if (!h) throw new Error(`no header ${id}`);
  return h;
};

const buttonOf = (el: ArgusTable<Row>, id: string) =>
  headerOf(el, id)
    .querySelector('slot')
    ?.assignedElements()[0]
    ?.querySelector<HTMLButtonElement>('.argus-header-menu-button') ?? null;

async function openMenu(el: ArgusTable<Row>, id: string): Promise<HTMLElement> {
  const button = buttonOf(el, id);
  if (!button) throw new Error(`no menu button on ${id}`);
  button.click();
  return vi.waitFor(() => {
    const menu = el.querySelector<HTMLElement>('.argus-header-menu:popover-open');
    if (!menu) throw new Error('menu not open');
    return menu;
  });
}

const labels = (menu: HTMLElement) =>
  [...menu.querySelectorAll<HTMLElement>('.argus-header-menu-item')].map((i) =>
    i.textContent.replace(/\s+/g, ' ').trim(),
  );

async function choose(el: ArgusTable<Row>, id: string, label: string): Promise<void> {
  const menu = await openMenu(el, id);
  const item = [...menu.querySelectorAll<HTMLElement>('.argus-header-menu-item')].find((i) =>
    i.textContent.trim().startsWith(label),
  );
  if (!item) throw new Error(`no item ${label}`);
  item.click();
}

async function editor(el: ArgusTable<Row>): Promise<HTMLDialogElement> {
  return vi.waitFor(() => {
    const dialog = el.querySelector<HTMLDialogElement>('dialog.argus-formula-editor');
    if (!dialog?.open) throw new Error('editor not open');
    return dialog;
  });
}

const field = (dialog: HTMLElement, label: string) => {
  const id = [...dialog.querySelectorAll('label')].find((l) => l.textContent === label)?.htmlFor;
  const input = id ? dialog.querySelector<HTMLInputElement>(`[id="${id}"]`) : null;
  if (!input) throw new Error(`no field ${label}`);
  return input;
};

/** Types into a field as a user would: the value, the cursor at the end, an input event. */
function type(input: HTMLInputElement, value: string, cursor = value.length) {
  input.focus();
  input.value = value;
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
}

const button = (dialog: HTMLElement, text: string) => {
  const found = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent.trim() === text || b.getAttribute('aria-label') === text,
  );
  if (!found) throw new Error(`no button ${text}`);
  return found;
};

const previewText = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll('.argus-formula-preview tr')].map((tr) =>
    [...tr.children].map((c) => c.textContent.trim()),
  );

const closed = (el: ArgusTable<Row>) =>
  vi.waitFor(() => {
    expect(el.querySelector('dialog.argus-formula-editor')).toBeNull();
  });

describe('column menu items', () => {
  test('edit: formula columns can be edited, renamed and deleted; every column can add one', async () => {
    const el = await fixture('edit');
    const menu = await openMenu(el, 'total');
    expect(labels(menu)).toEqual([
      'Fit width',
      'Edit formula… [Unit price] * [qty]',
      'Rename…',
      'Delete column',
      'Add formula column…',
    ]);
    expect(menu.querySelector('[role="group"]')?.textContent).toContain('Formula');
    // A column that can neither sort nor resize gets a menu for "Add formula column…".
    menu.hidePopover();
    await settle(el);
    expect(labels(await openMenu(el, 'id'))).toEqual(['Add formula column…']);
  });

  test('view: formula columns show their formula, read-only', async () => {
    const el = await fixture('view');
    expect(labels(await openMenu(el, 'total'))).toEqual([
      'Fit width',
      'View formula… [Unit price] * [qty]',
    ]);
    expect(buttonOf(el, 'id')).toBeNull();
  });

  test('none: nothing in the menu', async () => {
    const el = await fixture('none');
    expect(labels(await openMenu(el, 'total'))).toEqual(['Fit width']);
  });
});

describe('adding a column', () => {
  test('proposes the new column after the one whose menu was used', async () => {
    const el = await fixture();
    const added: FormulaColumnDetail[] = [];
    el.addEventListener('argus-formula-column-add', (e) => {
      added.push(e.detail);
      el.columns = e.detail.columns;
    });
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    expect(dialog.matches(':modal')).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Add formula column');
    const name = field(dialog, 'Column name');
    expect(document.activeElement).toBe(name);

    type(name, 'Per piece');
    type(field(dialog, 'Formula'), '[Unit price] / [Quantity]');
    await vi.waitFor(() => {
      expect(previewText(dialog)).toEqual([
        ['Order', 'Unit price', 'Quantity', 'Per piece (new)'],
        ['a', '2', '12', '0.166666666666667'],
        ['b', '0.5', '4', '0.125'],
        ['c', '10', '0', '#DIV/0!'],
      ]);
    });
    expect(dialog.textContent).toContain('Result: number');

    button(dialog, 'Add column').click();
    await closed(el);
    expect(added).toHaveLength(1);
    expect(added[0]?.column).toEqual({
      id: 'per-piece',
      header: 'Per piece',
      formula: '[Unit price] / [Quantity]',
      sortable: true,
    });
    expect(added[0]?.columns.map((c) => c.id)).toEqual([
      'id',
      'price',
      'qty',
      'per-piece',
      'total',
      'gross',
    ]);
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'qty'));
    expect(headerOf(el, 'per-piece')).toBeDefined();
  });

  test('checks the name and the formula before it saves', async () => {
    const el = await fixture();
    const added = vi.fn();
    el.addEventListener('argus-formula-column-add', added);
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    button(dialog, 'Add column').click();
    await el.updateComplete;
    expect(dialog.textContent).toContain('Give the column a name.');
    expect(document.activeElement).toBe(field(dialog, 'Column name'));

    type(field(dialog, 'Column name'), 'total');
    type(field(dialog, 'Formula'), '[Weight] * 2');
    button(dialog, 'Add column').click();
    expect(dialog.textContent).toContain('Another column is already called total.');
    expect(dialog.textContent).toContain('There is no column [Weight].');
    const formula = field(dialog, 'Formula');
    expect(formula.getAttribute('aria-invalid')).toBe('true');
    const describedBy = formula.getAttribute('aria-describedby') ?? '';
    expect(
      dialog.querySelector(`[id="${describedBy.split(' ')[0] ?? ''}"]`)?.textContent,
    ).toContain('There is no column [Weight].');
    expect(dialog.querySelector('.argus-formula-bad')?.textContent).toBe('[Weight]');

    type(field(dialog, 'Column name'), 'Self');
    type(formula, '[Self] + 1');
    button(dialog, 'Add column').click();
    expect(dialog.textContent).toContain('The formula depends on its own result.');
    expect(added).not.toHaveBeenCalled();
  });

  test('Cancel and Escape close without a change and focus the header', async () => {
    const el = await fixture();
    const added = vi.fn();
    el.addEventListener('argus-formula-column-add', added);
    await choose(el, 'price', 'Add formula column…');
    button(await editor(el), 'Cancel').click();
    await closed(el);
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'price'));

    await choose(el, 'price', 'Add formula column…');
    const dialog = await editor(el);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog.close();
    await closed(el);
    expect(added).not.toHaveBeenCalled();
  });

  test('a press inside the editor doesn’t sort the column it sits in', async () => {
    const el = await fixture();
    el.columns = columns.map((c) => ({ ...c, sortable: true }));
    await settle(el);
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    await settle(el);
    expect(el.sorting).toEqual([]);
    dialog.querySelector('h2')?.click();
    await settle(el);
    expect(el.sorting).toEqual([]);
  });
});

describe('the editor and the table', () => {
  test('opens again after the table was moved with the editor open', async () => {
    const el = await fixture();
    await choose(el, 'qty', 'Add formula column…');
    await editor(el);
    el.remove();
    document.body.append(el);
    await settle(el);
    expect(el.querySelector('dialog.argus-formula-editor')).toBeNull();
    await choose(el, 'qty', 'Add formula column…');
    expect((await editor(el)).open).toBe(true);
  });
});

describe('the formula field', () => {
  test('colours the formula and keeps the text in a mirror the input covers', async () => {
    const el = await fixture();
    await choose(el, 'total', 'Edit formula…');
    const dialog = await editor(el);
    const mirror = dialog.querySelector('.argus-formula-mirror');
    expect(mirror?.getAttribute('aria-hidden')).toBe('true');
    expect(mirror?.textContent).toBe('[Unit price] * [qty]');
    expect(
      [...(mirror?.querySelectorAll('.argus-formula-ref') ?? [])].map((s) => s.textContent),
    ).toEqual(['[Unit price]', '[qty]']);
    expect(document.activeElement).toBe(field(dialog, 'Formula'));
  });

  test('suggests columns after [ and functions by name; arrows and Enter take one', async () => {
    const el = await fixture();
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    const formula = field(dialog, 'Formula');
    type(formula, '[Un');
    await el.updateComplete;
    const list = () => dialog.querySelector('[role="listbox"]');
    expect(formula.getAttribute('role')).toBe('combobox');
    expect(formula.getAttribute('aria-expanded')).toBe('true');
    expect(
      [...(list()?.querySelectorAll('[role="option"]') ?? [])].map(
        (o) => o.firstElementChild?.textContent,
      ),
    ).toEqual(['Unit price']);
    formula.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(formula.value).toBe('[Unit price]');
    expect(list()).toBeNull();

    type(formula, '[Unit price] * ro');
    expect(
      [...(list()?.querySelectorAll('[role="option"]') ?? [])].map(
        (o) => o.firstElementChild?.textContent,
      ),
    ).toEqual(['ROUND', 'ROUNDDOWN', 'ROUNDUP']);
    formula.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    expect(formula.getAttribute('aria-activedescendant')).toBe(
      list()?.querySelectorAll('[role="option"]')[1]?.id,
    );
    formula.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(formula.value).toBe('[Unit price] * ROUNDDOWN(');
  });

  test('Escape closes the suggestions, not the dialog', async () => {
    const el = await fixture();
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    const formula = field(dialog, 'Formula');
    type(formula, '[');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    formula.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(dialog.querySelector('[role="listbox"]')).toBeNull();
    expect(dialog.open).toBe(true);
  });

  test('shows the arguments of the function the cursor is in', async () => {
    const el = await fixture();
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    const formula = field(dialog, 'Formula');
    type(formula, 'ROUND([Total], ');
    const hint = dialog.querySelector('.argus-formula-hint');
    expect(hint?.querySelector('code')?.textContent.replace(/\s+/g, '')).toBe(
      'ROUND(value,[digits])',
    );
    expect(hint?.querySelector('strong')?.textContent).toBe('[digits]');
    expect(hint?.textContent).toContain('Rounds a number to the given number of decimal places.');
    expect(formula.getAttribute('aria-describedby')).toContain(hint?.id ?? '-');
  });

  test('inserts columns and functions from the buttons', async () => {
    const el = await fixture();
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    button(dialog, 'Quantity').click();
    const formula = field(dialog, 'Formula');
    expect(formula.value).toBe('[Quantity]');
    const all = button(dialog, 'All functions');
    all.click();
    await el.updateComplete;
    expect(all.getAttribute('aria-expanded')).toBe('true');
    formula.setSelectionRange(0, 0);
    button(dialog, 'SQRT').click();
    expect(formula.value).toBe('SQRT([Quantity]');
  });
});

describe('changing a column', () => {
  test('Edit formula… proposes the new formula', async () => {
    const el = await fixture();
    const changes: FormulaColumnChangeDetail[] = [];
    el.addEventListener('argus-formula-column-change', (e) => changes.push(e.detail));
    await choose(el, 'total', 'Edit formula…');
    const dialog = await editor(el);
    expect(dialog.querySelector('h2')?.textContent).toBe('Edit formula column');
    type(field(dialog, 'Formula'), '[Unit price] * [qty] * 2');
    button(dialog, 'Save').click();
    await closed(el);
    expect(changes[0]?.previous.formula).toBe('[Unit price] * [qty]');
    expect(changes[0]?.column).toMatchObject({
      id: 'total',
      header: 'Total',
      formula: '[Unit price] * [qty] * 2',
    });
    expect(changes[0]?.columns.find((c) => c.id === 'total')?.formula).toBe(
      '[Unit price] * [qty] * 2',
    );
  });

  test('Rename… renames the column and the formulas that named it', async () => {
    const el = await fixture();
    const changes: FormulaColumnChangeDetail[] = [];
    el.addEventListener('argus-formula-column-change', (e) => changes.push(e.detail));
    await choose(el, 'total', 'Rename…');
    const dialog = await editor(el);
    const name = field(dialog, 'Column name');
    expect(document.activeElement).toBe(name);
    type(name, 'Net');
    button(dialog, 'Save').click();
    await closed(el);
    expect(changes[0]?.column.header).toBe('Net');
    expect(changes[0]?.columns.find((c) => c.id === 'gross')?.formula).toBe(
      'ROUND([Net] * 1.19, 2)',
    );
  });

  test('Rename… renames whole-column references too', async () => {
    const el = await fixture();
    el.columns = [
      ...columns,
      { id: 'share', header: 'Share', formula: '[Total] / SUM([[Total]])' },
    ];
    await settle(el);
    const changes: FormulaColumnChangeDetail[] = [];
    el.addEventListener('argus-formula-column-change', (e) => changes.push(e.detail));
    await choose(el, 'total', 'Rename…');
    const dialog = await editor(el);
    type(field(dialog, 'Column name'), 'Net');
    button(dialog, 'Save').click();
    await closed(el);
    expect(changes[0]?.columns.find((c) => c.id === 'share')?.formula).toBe('[Net] / SUM([[Net]])');
  });

  test('previews whole columns, and notes a total of one value without blocking', async () => {
    const el = await fixture();
    const changes: FormulaColumnChangeDetail[] = [];
    el.addEventListener('argus-formula-column-change', (e) => changes.push(e.detail));
    await choose(el, 'total', 'Edit formula…');
    const dialog = await editor(el);
    const formula = field(dialog, 'Formula');
    type(formula, '[qty] / SUM([[qty]])');
    await settle(el);
    expect(previewText(dialog).map((row) => row.at(-1))).toEqual(['Total', '0.75', '0.25', '0']);
    const note = () => dialog.querySelector('[id$="-note"]');
    expect(note()).toBeNull();
    type(formula, 'SUM([qty])');
    await settle(el);
    expect(note()?.textContent).toContain('For the whole column, write [[qty]]');
    expect(formula.getAttribute('aria-describedby')).toContain(note()?.id);
    expect(formula.getAttribute('aria-invalid')).toBe('false');
    button(dialog, 'Save').click();
    await closed(el);
    expect(changes[0]?.column.formula).toBe('SUM([qty])');
  });

  test('saving without a change proposes nothing', async () => {
    const el = await fixture();
    const changes = vi.fn();
    el.addEventListener('argus-formula-column-change', changes);
    await choose(el, 'total', 'Edit formula…');
    button(await editor(el), 'Save').click();
    await closed(el);
    expect(changes).not.toHaveBeenCalled();
  });

  test('Delete column proposes the columns without it and focuses a neighbour', async () => {
    const el = await fixture();
    const removed: FormulaColumnDetail[] = [];
    el.addEventListener('argus-formula-column-remove', (e) => removed.push(e.detail));
    await choose(el, 'total', 'Delete column');
    expect(removed[0]?.column.id).toBe('total');
    expect(removed[0]?.columns.map((c) => c.id)).toEqual(['id', 'price', 'qty', 'gross']);
    await settle(el);
    expect(el.shadowRoot?.activeElement).toBe(headerOf(el, 'gross'));
  });

  test('View formula… is read-only and only closes', async () => {
    const el = await fixture('view');
    await choose(el, 'gross', 'View formula…');
    const dialog = await editor(el);
    expect(dialog.querySelector('h2')?.textContent).toBe('Formula column');
    expect(field(dialog, 'Formula').readOnly).toBe(true);
    expect(field(dialog, 'Column name').readOnly).toBe(true);
    expect(dialog.querySelector('.argus-formula-insert')).toBeNull();
    expect(previewText(dialog)[0]).toEqual(['Order', 'Total', 'Gross']);
    button(dialog, 'Close').click();
    await closed(el);
  });
});

describe('labels', () => {
  async function germanFixture(rows: Row[] = data): Promise<ArgusTable<Row>> {
    const el = document.createElement('argus-table') as ArgusTable<Row>;
    Object.assign(el, {
      columns,
      data: rows,
      getRowId: (r: Row) => r.id,
      plugins: [
        formulas<Row>({
          editing: 'edit',
          labels: {
            formulaGroup: 'Formel',
            editFormula: 'Formel bearbeiten…',
            deleteColumn: 'Spalte löschen',
            addFormulaColumn: 'Formelspalte hinzufügen…',
            columnDeleted: ({ column }) => `${column} gelöscht`,
            addTitle: 'Formelspalte hinzufügen',
            columnName: 'Spaltenname',
            addColumn: 'Hinzufügen',
            nameMissing: 'Die Spalte braucht einen Namen.',
            preview: ({ count }) => `Vorschau, ${String(count)} Zeilen`,
            noPreviewRows: 'Noch keine Zeilen.',
            newColumn: ({ name }) => `${name || 'Neue Spalte'} (neu)`,
            functionGroup: ({ group }) => (group === 'Math' ? 'Mathematik' : group),
            functionGroupList: ({ name }) => `Funktionen: ${name}`,
          },
        }),
        headerMenu<Row>({ pin: false, hide: false }),
      ],
    });
    el.style.inlineSize = '900px';
    el.style.blockSize = '300px';
    document.body.append(el);
    await settle(el);
    return el;
  }
  const announced = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return document.querySelector('[data-argus-announcer]')?.textContent;
  };

  test('translate the menu items and announcements', async () => {
    const el = await germanFixture();
    const menu = await openMenu(el, 'total');
    expect(labels(menu)).toContain('Formel bearbeiten… [Unit price] * [qty]');
    expect(labels(menu)).toContain('Rename…');
    expect(labels(menu)).toContain('Formelspalte hinzufügen…');
    expect(menu.querySelector('.argus-header-menu-group-label')?.textContent).toBe('Formel');
    [...menu.querySelectorAll<HTMLElement>('.argus-header-menu-item')]
      .find((i) => i.textContent.trim() === 'Spalte löschen')
      ?.click();
    expect(await announced()).toBe('Total gelöscht');
  });

  test('translate the editor, keeping the others English', async () => {
    const el = await germanFixture();
    await choose(el, 'qty', 'Formelspalte hinzufügen…');
    const dialog = await editor(el);
    expect(dialog.querySelector('h2')?.textContent).toBe('Formelspalte hinzufügen');
    button(dialog, 'Hinzufügen').click();
    await el.updateComplete;
    expect(dialog.textContent).toContain('Die Spalte braucht einen Namen.');
    expect(document.activeElement).toBe(field(dialog, 'Spaltenname'));
    expect(field(dialog, 'Formula')).toBeInstanceOf(HTMLInputElement);
    type(field(dialog, 'Formula'), '[qty] * 2');
    await el.updateComplete;
    expect(dialog.textContent).toContain('Vorschau, 3 Zeilen');
    expect(previewText(dialog)[0]).toContain('Neue Spalte (neu)');
    button(dialog, 'All functions').click();
    await el.updateComplete;
    const math = dialog.querySelector('[aria-label="Funktionen: Mathematik"]');
    expect(math?.querySelector('.argus-formula-functions-group')?.textContent).toBe('Mathematik');
    button(dialog, 'Cancel').click();
    await closed(el);
  });

  test('English defaults: the preview of one row says so', async () => {
    const el = await fixture();
    el.data = data.slice(0, 1);
    await settle(el);
    await choose(el, 'qty', 'Add formula column…');
    const dialog = await editor(el);
    type(field(dialog, 'Formula'), '[qty] * 2');
    await el.updateComplete;
    expect(dialog.textContent).toContain('Preview, first row');
    expect(dialog.textContent).not.toContain('first 1 rows');
  });
});
