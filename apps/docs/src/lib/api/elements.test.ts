import { readFileSync } from 'node:fs';
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
            {
              kind: 'field',
              name: 'density',
              type: { text: 'Density' },
              attribute: 'density',
              default: "'comfortable'",
            },
            {
              kind: 'field',
              name: 'contentRenderer',
              type: { text: 'ContentRenderer | undefined' },
            },
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
            {
              kind: 'method',
              name: 'autosizeColumns',
              return: { type: { text: 'Promise<void>' } },
              parameters: [{ name: 'ids', optional: true, type: { text: 'readonly string[]' } }],
              description: 'Fits columns.',
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
    expect(property('columnSizing')?.bindings).toEqual({
      react: 'columnSizing',
      vue: 'v-model:column-sizing',
      angular: '[(columnSizing)]',
    });
    expect(property('density')).toMatchObject({
      attribute: 'density',
      default: "'comfortable'",
      bindings: { react: 'density', vue: ':density', angular: '[density]' },
    });
    expect(property('secret')).toBeUndefined();
  });

  test('a property the wrappers set themselves has no bindings', () => {
    expect(property('contentRenderer')).toBeDefined();
    expect(property('contentRenderer')?.bindings).toBeUndefined();
  });

  test('events carry their names in each wrapper', () => {
    expect(event('argus-row-click')).toMatchObject({
      type: 'CustomEvent<RowClickDetail<T>>',
      bindings: { react: 'onRowClick', vue: '@row-click', angular: '(rowClick)' },
    });
    expect(event('argus-row-click')?.angularEmits).toBeUndefined();
    // Angular's output for a state change emits the new value, not the event.
    expect(event('argus-column-sizing-change')?.angularEmits).toBe('columnSizing');
    expect(event('argus-row-click')?.from).toBeUndefined();
    expect(event('argus-formula-column-add')?.from).toBe('@argus-table/formulas');
    expect(event('argus-cell-edit')?.from).toBe('@argus-table/editing');
  });

  test('methods get a TypeScript signature, optional parameters marked', () => {
    expect(table.methods.map((m) => m.signature)).toEqual([
      'scrollToRow(target: RowTarget, options?: ScrollToRowOptions): Promise<boolean>',
      'autosizeColumns(ids?: readonly string[]): Promise<void>',
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

  test("bindings are the generated wrappers' own", () => {
    const generated = (framework: string) =>
      readFileSync(
        new URL(`../../../../../packages/${framework}/src/generated/elements.ts`, import.meta.url),
        'utf8',
      );
    const [react, vue, angular] = ['react', 'vue', 'angular'].map(generated);
    for (const tag of ELEMENT_TAGS) {
      for (const p of elementReference(manifest, tag).properties) {
        // Picked by name (React, Vue), declared as a prop (content props), or an Angular setter.
        const listed = (text = '') =>
          text.includes(`'${p.name}'`) ||
          new RegExp(`\\b${p.name}\\?:`).test(text) ||
          text.includes(`set ${p.name}(`);
        expect([listed(react), listed(vue), listed(angular)], `${tag}.${p.name}`).toEqual(
          p.bindings ? [true, true, true] : [false, false, false],
        );
      }
    }
  });

  test('the real manifest reads for every element', () => {
    for (const tag of ELEMENT_TAGS) {
      expect(elementReference(manifest, tag).properties.length).toBeGreaterThan(0);
    }
    expect(elementReference(manifest, 'argus-table').parts.length).toBeGreaterThan(20);
  });
});
