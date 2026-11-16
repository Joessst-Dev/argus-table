import { describe, expect, test } from 'vitest';
import manifest from 'argus-table/custom-elements.json';
import { ELEMENT_TAGS, elementReference } from './elements';

/** A manifest with one <argus-table>, holding one of each kind of entry. */
const fixture = {
  modules: [
    {
      declarations: [
        {
          kind: 'class',
          name: 'ArgusTable',
          tagName: 'argus-table',
          customElement: true,
          description: 'A data table.',
          members: [
            {
              kind: 'field',
              name: 'columnSizing',
              type: { text: 'ColumnSizingState | undefined' },
              description: 'Column widths by id.',
            },
            { kind: 'field', name: 'density', type: { text: 'Density' }, attribute: 'density' },
            {
              kind: 'method',
              name: 'scrollToRow',
              return: { type: { text: 'Promise<boolean>' } },
              parameters: [
                { name: 'target', type: { text: 'RowTarget' } },
                { name: 'options', default: '{}', type: { text: 'ScrollToRowOptions' } },
              ],
              description: 'Scrolls to a row.',
            },
            { kind: 'field', name: 'secret', privacy: 'private', type: { text: 'string' } },
          ],
          events: [
            {
              name: 'argus-column-sizing-change',
              type: { text: 'CustomEvent<ColumnSizingChangeDetail>' },
              description: 'Widths changed.',
            },
            {
              name: 'argus-row-click',
              type: { text: 'CustomEvent<RowClickDetail<T>>' },
              description: 'A row was clicked.',
            },
          ],
          slots: [{ name: 'empty', description: 'Shown without rows.' }],
          cssParts: [{ name: 'row', description: 'Every body row.' }],
          cssProperties: [
            { name: '--argus-fg', description: 'Text colour.', default: 'CanvasText' },
          ],
        },
      ],
    },
  ],
};

describe('elementReference', () => {
  const table = elementReference(fixture, 'argus-table');
  const property = (name: string) => table.properties.find((p) => p.name === name);
  const event = (name: string) => table.events.find((e) => e.name === name);

  test('properties carry their bindings in each wrapper', () => {
    expect(property('columnSizing')).toMatchObject({
      react: 'columnSizing',
      vue: 'v-model:column-sizing',
      angular: '[(columnSizing)]',
    });
    expect(property('density')).toMatchObject({
      attribute: 'density',
      react: 'density',
      vue: ':density',
      angular: '[density]',
    });
    expect(property('secret')).toBeUndefined();
  });

  test('events carry their names in each wrapper', () => {
    expect(event('argus-row-click')).toMatchObject({
      type: 'CustomEvent<RowClickDetail<T>>',
      react: 'onRowClick',
      vue: '@row-click',
      angular: '(rowClick)',
    });
    expect(event('argus-row-click')?.from).toBeUndefined();
    expect(event('argus-formula-column-add')?.from).toBe('@argus-table/formulas');
    expect(event('argus-cell-edit')?.from).toBe('@argus-table/editing');
  });

  test('methods get a signature', () => {
    expect(table.methods).toEqual([
      {
        name: 'scrollToRow',
        signature:
          'scrollToRow(target: RowTarget, options = {}: ScrollToRowOptions): Promise<boolean>',
        description: 'Scrolls to a row.',
      },
    ]);
  });

  test('slots, parts and tokens keep their docs and defaults', () => {
    expect(table.description).toBe('A data table.');
    expect(table.slots).toEqual([{ name: 'empty', description: 'Shown without rows.' }]);
    expect(table.parts).toEqual([{ name: 'row', description: 'Every body row.' }]);
    expect(table.tokens).toEqual([
      { name: '--argus-fg', description: 'Text colour.', default: 'CanvasText' },
    ]);
  });

  test('a member without a description has an empty one', () => {
    expect(property('density')?.description).toBe('');
  });

  test('the real manifest reads for every element', () => {
    for (const tag of ELEMENT_TAGS) {
      expect(elementReference(manifest, tag).properties.length).toBeGreaterThan(0);
    }
    expect(elementReference(manifest, 'argus-table').parts.length).toBeGreaterThan(20);
  });
});
