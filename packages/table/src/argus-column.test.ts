import { afterEach, describe, expect, test, vi } from 'vitest';
import { html } from 'lit';
import { ArgusColumn, type ArgusTable } from './index.js';
import { people, rowText, rowsInOrder, scrollTo, settle, shadow, slotted } from './test-utils.js';
import type { Person } from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** Mounts a sized table whose columns are the given `<argus-column>` markup. */
async function mount(
  markup: string,
  props: Partial<ArgusTable<Person>> = {},
): Promise<ArgusTable<Person>> {
  const el = document.createElement('argus-table') as ArgusTable<Person>;
  el.innerHTML = markup;
  Object.assign(el, { data: people(3), ...props });
  el.style.inlineSize = '800px';
  el.style.blockSize = '400px';
  document.body.append(el);
  await settle(el);
  return el;
}

const BASIC = `
  <argus-column column-id="name" header="Name" accessor="name" width="200"></argus-column>
  <argus-column column-id="age" header="Age" accessor="age" width="80" align="end"></argus-column>
  <argus-column column-id="city" header="City" accessor="address.city" width="1fr" min-width="120"></argus-column>
`;

const headers = (el: HTMLElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]'),
];
const headerTexts = (el: HTMLElement) => headers(el).map((h) => slotted(h)?.textContent ?? '');
const cols = (el: HTMLElement) =>
  shadow(el).querySelector<HTMLElement>('[part~="table"]')?.style.getPropertyValue('--_cols');
const column = (el: HTMLElement, id: string) => {
  const c = [...el.querySelectorAll('argus-column')].find((x) => x.columnId === id);
  if (!c) throw new Error(`no column ${id}`);
  return c;
};

describe('<argus-column>', () => {
  test('registers <argus-column> as a data-only element', () => {
    const c = document.createElement('argus-column');
    expect(c).toBeInstanceOf(ArgusColumn);
    expect(c.shadowRoot).toBeNull();
  });

  test('builds the columns from attributes', async () => {
    const el = await mount(BASIC);
    expect(headerTexts(el)).toEqual(['Name', 'Age', 'City']);
    expect(rowsInOrder(el).map(rowText)).toEqual([
      ['Person 0', '0', 'City 0'],
      ['Person 1', '1', 'City 1'],
      ['Person 2', '2', 'City 2'],
    ]);
    expect(cols(el)).toBe('200px 80px minmax(120px, 1fr)');
    expect(headers(el)[1]?.dataset.align).toBe('end');
  });

  test('reads width as px, auto or a flex share', () => {
    const c = document.createElement('argus-column');
    const width = (value: string) => {
      c.setAttribute('width', value);
      return c.width;
    };
    expect(width('90')).toBe(90);
    expect(width('90px')).toBe(90);
    expect(width('auto')).toBe('auto');
    expect(width('2fr')).toEqual({ flex: 2 });
    expect(width('0.5fr')).toEqual({ flex: 0.5 });
    expect(width('wide')).toBeUndefined();
  });

  test('flag attributes: absent keeps the default, "false" turns it off', async () => {
    const el = await mount(`
      <argus-column column-id="a" header="A" accessor="name" sortable></argus-column>
      <argus-column column-id="b" header="B" accessor="age" resizable="false"></argus-column>
      <argus-column column-id="c" header="C" accessor="id"></argus-column>
    `);
    const [a, b, c] = headers(el);
    expect(a?.querySelector('[part~="resize-handle"]')).not.toBeNull();
    expect(b?.querySelector('[part~="resize-handle"]')).toBeNull();
    expect(c?.querySelector('[part~="resize-handle"]')).not.toBeNull();
    expect(column(el, 'a').toColumnDef()).toMatchObject({ sortable: true });
    expect(column(el, 'c').toColumnDef()).toMatchObject({
      sortable: undefined,
      resizable: undefined,
    });

    a?.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'a', desc: false }]);
  });

  test('passes a formula on for a plugin to read', async () => {
    const el = await mount(`
      <argus-column column-id="t" header="Total" formula="[price] * [qty]"></argus-column>
    `);
    expect(column(el, 't').toColumnDef()).toMatchObject({ formula: '[price] * [qty]' });
  });

  test('pins columns from the pin attribute', async () => {
    const el = await mount(`
      <argus-column column-id="name" header="Name" accessor="name" pin="start"></argus-column>
      <argus-column column-id="age" header="Age" accessor="age"></argus-column>
      <argus-column column-id="city" header="City" accessor="address.city" pin="sideways"></argus-column>
    `);
    expect(headers(el).map((h) => h.dataset.pin ?? null)).toEqual(['start', null, null]);
  });

  test('takes functions and rich content as properties', async () => {
    const el = await mount(`
      <argus-column column-id="name"></argus-column>
      <argus-column column-id="double"></argus-column>
    `);
    const name = column(el, 'name') as ArgusColumn<Person>;
    name.header = html`<i>N</i>`;
    name.cell = (row, ctx) => html`<b>${row.name}#${String(ctx.index)}</b>`;
    const double = column(el, 'double') as ArgusColumn<Person>;
    double.header = 'Double';
    double.accessor = (row) => row.age * 2;
    await settle(el);
    expect(slotted(headers(el)[0] as Element)?.querySelector('i')?.textContent).toBe('N');
    expect(rowsInOrder(el).map(rowText)).toEqual([
      ['Person 0#0', '0'],
      ['Person 1#1', '2'],
      ['Person 2#2', '4'],
    ]);
  });

  test('renders a <template> child in every cell, cloned once per cell', async () => {
    const el = await mount(
      `<argus-column column-id="name" header="Name" accessor="name"></argus-column>
       <argus-column column-id="actions" header="Actions">
         <template><button class="act">Open</button></template>
       </argus-column>`,
      { data: people(200) },
    );
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('button.act')];
    // Only the rendered cells hold a clone, not the template itself.
    const rendered = rowsInOrder(el).length;
    expect(buttons()).toHaveLength(rendered);
    const before = buttons();
    // Re-rendered cells keep their clone: a new order changes no node.
    el.sorting = [{ id: 'name', desc: true }];
    await settle(el);
    expect(buttons()).toEqual(before);
    await scrollTo(el, 2000);
    expect(buttons()).toHaveLength(rowsInOrder(el).length);
  });

  test('picks up a <template> added after the column connected', async () => {
    const el = await mount(`<argus-column column-id="x" header="X"></argus-column>`);
    const template = document.createElement('template');
    template.innerHTML = '<em>hi</em>';
    column(el, 'x').append(template);
    await settle(el);
    await settle(el);
    expect(rowsInOrder(el).map(rowText)).toEqual([['hi'], ['hi'], ['hi']]);
  });

  test('the cell property wins over a <template> child', async () => {
    const el = await mount(
      `<argus-column column-id="x" header="X"><template>static</template></argus-column>`,
    );
    (column(el, 'x') as ArgusColumn<Person>).cell = (row) => row.id;
    await settle(el);
    expect(rowsInOrder(el).map(rowText)).toEqual([['p0'], ['p1'], ['p2']]);
  });

  test('ignores columns that are not direct children', async () => {
    const el = await mount(`
      <argus-column column-id="name" header="Name" accessor="name"></argus-column>
      <div><argus-column column-id="age" header="Age" accessor="age"></argus-column></div>
    `);
    expect(headerTexts(el)).toEqual(['Name']);
  });
});

describe('changing <argus-column> children', () => {
  test('follows added, removed and moved columns', async () => {
    const el = await mount(BASIC);
    const extra = document.createElement('argus-column');
    extra.columnId = 'id';
    extra.header = 'Id';
    extra.accessor = 'id';
    el.append(extra);
    await settle(el);
    expect(headerTexts(el)).toEqual(['Name', 'Age', 'City', 'Id']);

    column(el, 'age').remove();
    await settle(el);
    expect(headerTexts(el)).toEqual(['Name', 'City', 'Id']);

    el.insertBefore(extra, column(el, 'name'));
    await settle(el);
    expect(headerTexts(el)).toEqual(['Id', 'Name', 'City']);
    expect(rowsInOrder(el).map(rowText)[0]).toEqual(['p0', 'Person 0', 'City 0']);
  });

  test('follows attribute changes', async () => {
    const el = await mount(BASIC);
    column(el, 'age').setAttribute('header', 'Years');
    column(el, 'age').setAttribute('width', '120');
    await settle(el);
    expect(headerTexts(el)).toEqual(['Name', 'Years', 'City']);
    expect(cols(el)).toBe('200px 120px minmax(120px, 1fr)');
  });

  test('keeps resized widths, order and sorting across a rebuild, by column id', async () => {
    const el = await mount(BASIC.replace('accessor="name"', 'accessor="name" sortable'));
    el.columnSizing = { name: 250 };
    el.columnOrder = ['age', 'name', 'city'];
    el.sorting = [{ id: 'name', desc: true }];
    await settle(el);
    column(el, 'city').setAttribute('header', 'Town');
    await settle(el);
    expect(headerTexts(el)).toEqual(['Age', 'Name', 'Town']);
    expect(cols(el)).toBe('80px 250px minmax(120px, 1fr)');
    expect(rowsInOrder(el).map(rowText)[0]).toEqual(['2', 'Person 2', 'City 2']);
  });

  test('keeps cell content intact when a column is appended after the first render', async () => {
    const el = await mount(BASIC.replace('accessor="age"', 'accessor="age" sortable'), {
      data: people(500),
    });
    const extra = document.createElement('argus-column');
    extra.columnId = 'id';
    extra.accessor = 'id';
    el.append(extra);
    await settle(el);
    await scrollTo(el, 4000);
    el.sorting = [{ id: 'age', desc: true }];
    await settle(el);
    await scrollTo(el, 0);
    expect(el.lastElementChild).toBe(extra);
    expect(headers(el)).toHaveLength(4);
    const first = rowsInOrder(el)[0];
    expect(first && rowText(first)[1]).toBe('89');
    expect(first && rowText(first)[3]).toMatch(/^p\d+$/);
  });

  test('renders again after innerHTML replaced every child', async () => {
    const el = await mount(BASIC);
    el.innerHTML = `<argus-column column-id="id" header="Id" accessor="id"></argus-column>`;
    await settle(el);
    await settle(el);
    expect(headerTexts(el)).toEqual(['Id']);
    expect(rowsInOrder(el).map(rowText)).toEqual([['p0'], ['p1'], ['p2']]);
  });
});

describe('columns property and <argus-column> children', () => {
  test('a non-empty columns wins over the children, with one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await mount(BASIC, { columns: [{ id: 'id', header: 'Id', accessor: 'id' }] });
    expect(headerTexts(el)).toEqual(['Id']);
    column(el, 'age').setAttribute('header', 'Years');
    await settle(el);
    expect(headerTexts(el)).toEqual(['Id']);
    expect(warn).toHaveBeenCalledTimes(1);

    el.columns = [];
    await settle(el);
    expect(headerTexts(el)).toEqual(['Name', 'Years', 'City']);
  });
});
