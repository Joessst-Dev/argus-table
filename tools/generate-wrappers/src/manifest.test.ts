import { describe, expect, test } from 'vitest';
import { eventNames, readElement, referencedTypes, type Manifest } from './manifest.ts';
import { emitReact } from './react.ts';

type Declaration = NonNullable<Manifest['modules'][number]['declarations']>[number];

/** A small manifest in the shape the analyzer writes for argus-table. */
function manifest(
  overrides: { tableMembers?: Declaration['members']; tableEvents?: Declaration['events'] } = {},
): Manifest {
  return {
    modules: [
      {
        declarations: [
          {
            kind: 'class',
            name: 'ArgusTable',
            tagName: 'argus-table',
            customElement: true,
            members: overrides.tableMembers ?? [
              { kind: 'field', name: 'data', type: { text: 'readonly T[]' } },
              { kind: 'field', name: 'sorting', type: { text: 'SortState' } },
              { kind: 'field', name: 'columnSizing', type: { text: 'ColumnSizingState' } },
              { kind: 'field', name: 'columnOrder', type: { text: 'ColumnOrderState' } },
              { kind: 'field', name: 'styles', static: true, type: { text: 'CSSResultGroup' } },
              { kind: 'method', name: 'refresh' },
            ],
            events: overrides.tableEvents ?? [
              {
                name: 'argus-sort-change',
                type: { text: 'CustomEvent<SortChangeDetail>' },
                description: 'Sorted.',
              },
              { name: 'argus-column-resize', type: { text: 'CustomEvent<ColumnResizeDetail>' } },
              {
                name: 'argus-column-reorder',
                type: { text: 'CustomEvent<ColumnReorderDetail>' },
              },
              { name: 'argus-row-click', type: { text: 'CustomEvent<RowClickDetail<T>>' } },
            ],
          },
        ],
      },
      {
        declarations: [
          {
            kind: 'class',
            name: 'ArgusColumn',
            tagName: 'argus-column',
            customElement: true,
            members: [
              { kind: 'field', name: 'columnId', type: { text: 'string' } },
              { kind: 'method', name: 'toColumnDef' },
            ],
          },
        ],
      },
    ],
  };
}

describe('eventNames', () => {
  test('drops the prefix and follows each framework’s style', () => {
    expect(eventNames('argus-column-resize')).toEqual({
      react: 'onColumnResize',
      vue: 'column-resize',
      angular: 'columnResize',
    });
  });

  test('rejects events without the argus- prefix', () => {
    expect(() => eventNames('sort-change')).toThrow(/argus-/);
  });
});

describe('readElement', () => {
  test('reads properties, events, methods and models', () => {
    const table = readElement(manifest(), 'argus-table');
    expect(table.className).toBe('ArgusTable');
    expect(table.generic).toBe(true);
    expect(table.properties.map((p) => p.name)).toEqual([
      'data',
      'sorting',
      'columnSizing',
      'columnOrder',
    ]);
    expect(table.methods).toEqual(['refresh']);
    expect(table.events[0]).toEqual({
      name: 'argus-sort-change',
      type: 'CustomEvent<SortChangeDetail>',
      description: 'Sorted.',
      react: 'onSortChange',
      vue: 'sort-change',
      angular: 'sortChange',
    });
    expect(table.models.map((m) => [m.property, m.event, m.detailKey])).toEqual([
      ['sorting', 'argus-sort-change', 'sorting'],
      ['columnSizing', 'argus-column-resize', 'sizing'],
      ['columnOrder', 'argus-column-reorder', 'order'],
    ]);
  });

  test('leaves out methods that only serve the table', () => {
    const column = readElement(manifest(), 'argus-column');
    expect(column.methods).toEqual([]);
    expect(column.generic).toBe(false);
  });

  test('fails when a model’s event was renamed', () => {
    const m = manifest({
      tableEvents: [
        { name: 'argus-sort', type: { text: 'CustomEvent<SortChangeDetail>' } },
        { name: 'argus-column-resize', type: { text: 'CustomEvent<ColumnResizeDetail>' } },
        { name: 'argus-column-reorder', type: { text: 'CustomEvent<ColumnReorderDetail>' } },
      ],
    });
    expect(() => readElement(m, 'argus-table')).toThrow(/no event "argus-sort-change"/);
  });

  test('fails when a model’s property is missing', () => {
    const m = manifest({ tableMembers: [{ kind: 'field', name: 'sorting', type: { text: 'x' } }] });
    expect(() => readElement(m, 'argus-table')).toThrow(/no property "columnSizing"/);
  });

  test('fails when an event has no type', () => {
    const m = manifest({ tableEvents: [{ name: 'argus-sort-change' }] });
    expect(() => readElement(m, 'argus-table')).toThrow(/@fires \{CustomEvent<…>\}/);
  });

  test('fails when the element is missing', () => {
    expect(() => readElement({ modules: [] }, 'argus-table')).toThrow(/<argus-table>/);
  });
});

describe('referencedTypes', () => {
  test('lists the named types, without globals and the row type', () => {
    expect(referencedTypes('CustomEvent<CellClickDetail<T>>')).toEqual(['CellClickDetail']);
    expect(referencedTypes('readonly ColumnDef<T>[] | Record<string, Node>')).toEqual([
      'ColumnDef',
    ]);
  });
});

describe('emitReact', () => {
  test('emits a typed @lit/react component per element', () => {
    const m = manifest();
    const source = emitReact([readElement(m, 'argus-table'), readElement(m, 'argus-column')]);

    expect(source).toContain(
      "import { ArgusTable as ArgusTableElement, ArgusColumn as ArgusColumnElement } from 'argus-table';",
    );
    expect(source).toContain(
      "import type { ColumnReorderDetail, ColumnResizeDetail, RowClickDetail, SortChangeDetail } from 'argus-table';",
    );
    expect(source).toContain(
      "export type ArgusTableElementProps<T = unknown> = Partial<Pick<ArgusTableElement<T>, 'data' | 'sorting' | 'columnSizing' | 'columnOrder'>>;",
    );
    expect(source).toContain('onRowClick?: (event: CustomEvent<RowClickDetail<T>>) => void;');
    expect(source).toContain("onSortChange: 'argus-sort-change',");
    expect(source).toContain(
      '}) as unknown as <T = unknown>(props: ArgusTableProps<T>) => React.ReactElement | null;',
    );
    // No events: no event props interface, and no type parameter when nothing uses T.
    expect(source).not.toContain('ArgusColumnEventProps');
    expect(source).toContain(
      '}) as unknown as (props: ArgusColumnProps) => React.ReactElement | null;',
    );
  });
});
