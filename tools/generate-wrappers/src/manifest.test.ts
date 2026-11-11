import { describe, expect, test } from 'vitest';
import { eventNames, readElement, referencedTypes, type Manifest } from './manifest.ts';
import { emitAngular } from './angular.ts';
import { emitReact } from './react.ts';
import { emitVue } from './vue.ts';

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
              {
                kind: 'field',
                name: 'rowHeight',
                type: { text: "number | 'auto' | undefined" },
                attribute: 'row-height',
              },
              { kind: 'field', name: 'sorting', type: { text: 'SortState' } },
              { kind: 'field', name: 'columnSizing', type: { text: 'ColumnSizingState' } },
              { kind: 'field', name: 'columnOrder', type: { text: 'ColumnOrderState' } },
              { kind: 'field', name: 'columnPinning', type: { text: 'ColumnPinningState' } },
              {
                kind: 'field',
                name: 'columnVisibility',
                type: { text: 'ColumnVisibilityState' },
              },
              { kind: 'field', name: 'columnFilters', type: { text: 'ColumnFilterState' } },
              { kind: 'field', name: 'selection', type: { text: 'SelectionState' } },
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
              { name: 'argus-column-pin', type: { text: 'CustomEvent<ColumnPinDetail>' } },
              { name: 'argus-column-hide', type: { text: 'CustomEvent<ColumnHideDetail>' } },
              {
                name: 'argus-column-filter',
                type: { text: 'CustomEvent<ColumnFilterDetail>' },
              },
              { name: 'argus-row-click', type: { text: 'CustomEvent<RowClickDetail<T>>' } },
              {
                name: 'argus-row-select',
                type: { text: 'CustomEvent<RowSelectDetail>' },
              },
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
              {
                kind: 'field',
                name: 'sortable',
                type: { text: 'boolean | undefined' },
                attribute: 'sortable',
                description: 'Sortable.',
              },
              {
                kind: 'field',
                name: 'width',
                type: { text: 'ColumnWidth | undefined' },
                attribute: 'width',
              },
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
      'rowHeight',
      'sorting',
      'columnSizing',
      'columnOrder',
      'columnPinning',
      'columnVisibility',
      'columnFilters',
      'selection',
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
      ['columnPinning', 'argus-column-pin', 'pinning'],
      ['columnVisibility', 'argus-column-hide', 'visibility'],
      ['columnFilters', 'argus-column-filter', 'filters'],
      ['selection', 'argus-row-select', 'selection'],
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

  test('fails when an event takes the name of a two-way output', () => {
    const m = manifest({
      tableEvents: [
        { name: 'argus-sort-change', type: { text: 'CustomEvent<SortChangeDetail>' } },
        { name: 'argus-sorting-change', type: { text: 'CustomEvent<SortChangeDetail>' } },
      ],
    });
    expect(() => readElement(m, 'argus-table')).toThrow(/collides with the Angular output/);
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
      "import type { ColumnFilterDetail, ColumnHideDetail, ColumnPinDetail, ColumnReorderDetail, ColumnResizeDetail, RowClickDetail, RowSelectDetail, SortChangeDetail } from 'argus-table';",
    );
    expect(source).toContain(
      "export type ArgusTableElementProps<T = unknown> = Partial<Pick<ArgusTableElement<T>, 'data' | 'rowHeight' | 'sorting' | 'columnSizing' | 'columnOrder' | 'columnPinning' | 'columnVisibility' | 'columnFilters' | 'selection'>>;",
    );
    expect(source).toContain('onRowClick?: (event: CustomEvent<RowClickDetail<T>>) => void;');
    expect(source).toContain("onSortChange: 'argus-sort-change',");
    // Elements with events only pass their own events on (a nested table's bubble too).
    expect(source).toContain("import { ownEvents } from '../own-events.js';");
    expect(source).toContain('export const ArgusTable = ownEvents(createComponent({');
    expect(source).toContain(
      "}), ['onSortChange', 'onColumnResize', 'onColumnReorder', 'onColumnPin', 'onColumnHide', 'onColumnFilter', 'onRowClick', 'onRowSelect'], 'ArgusTable') as unknown as <T = unknown>(props: ArgusTableProps<T>) => React.ReactElement | null;",
    );
    // No events: no event props interface, and no type parameter when nothing uses T.
    expect(source).not.toContain('ArgusColumnEventProps');
    expect(source).toContain('export const ArgusColumn = createComponent({');
    expect(source).toContain(
      '}) as unknown as (props: ArgusColumnProps) => React.ReactElement | null;',
    );
  });
});

/** The fixture with the properties that carry content: `columns`, `contentRenderer`, `header`, `cell`. */
function contentManifest(): Manifest {
  const defaults = manifest();
  const [, columnModule] = defaults.modules;
  const tableMembers = defaults.modules[0]?.declarations?.[0]?.members ?? [];
  const column = columnModule?.declarations?.[0];
  if (!column) throw new Error('fixture');
  const withTable = manifest({
    tableMembers: [
      ...tableMembers,
      { kind: 'field', name: 'columns', type: { text: 'readonly ColumnDef<T>[]' } },
      { kind: 'field', name: 'contentRenderer', type: { text: 'ContentRenderer | undefined' } },
    ],
  });
  return {
    modules: [
      ...withTable.modules.slice(0, 1),
      {
        declarations: [
          {
            ...column,
            members: [
              ...(column.members ?? []),
              { kind: 'field', name: 'header', type: { text: 'CellContent' } },
              { kind: 'field', name: 'cell', type: { text: '(row: T) => CellContent' } },
            ],
          },
        ],
      },
    ],
  };
}

describe('emitReact with content', () => {
  test('types header, cell and columns for React content and wraps a table that renders it', () => {
    const base = contentManifest();
    const source = emitReact([readElement(base, 'argus-table'), readElement(base, 'argus-column')]);
    expect(source).toContain(
      "import { withContent, type ReactCellContent, type ReactColumnDef } from '../content.js';",
    );
    expect(source).toContain('columns?: readonly ReactColumnDef<T>[] | null;');
    expect(source).not.toMatch(/'contentRenderer'|contentRenderer\?:/);
    expect(source).toContain('header?: ReactCellContent | (() => ReactCellContent);');
    expect(source).toContain('cell?: (row: T, context: CellContext<T>) => ReactCellContent;');
    expect(source).toContain('export const ArgusTable = withContent(ownEvents(');
    expect(source).not.toContain('export const ArgusColumn = withContent(');
  });
});

describe('emitAngular with content', () => {
  test('extends ArgusTableBase, types content inputs and drops contentRenderer', () => {
    const base = contentManifest();
    const source = emitAngular([
      readElement(base, 'argus-table'),
      readElement(base, 'argus-column'),
    ]);
    expect(source).toContain(
      "import { ArgusTableBase, type AngularCellContent, type AngularColumnDef } from '../content.js';",
    );
    expect(source).toContain(
      'export class ArgusTableComponent<T = unknown> extends ArgusTableBase<T> {',
    );
    expect(source).toContain(
      '@Input() set columns(value: (readonly AngularColumnDef<T>[]) | null | undefined)',
    );
    expect(source).not.toContain('set contentRenderer');
    expect(source).toContain(
      '@Input() set cell(value: ((row: T, context: CellContext<T>) => AngularCellContent) | null | undefined)',
    );
    // The column component keeps its own element field.
    expect(source).toMatch(
      /export class ArgusColumnComponent<T = unknown> \{\n {2}\/\*\* The `<argus-column>` element/,
    );
  });
});

describe('emitVue with content', () => {
  test('types content, adds cell and header slots, and marks the spec', () => {
    const base = contentManifest();
    const source = emitVue([readElement(base, 'argus-table'), readElement(base, 'argus-column')]);
    expect(source).toContain(
      "import type { HeaderSlotProps, VueCellContent, VueColumnDef } from '../content.js';",
    );
    expect(source).toContain('columns?: readonly VueColumnDef<T>[] | null;');
    expect(source).not.toMatch(/'contentRenderer'|contentRenderer\?:/);
    expect(source).toContain('export interface ArgusTableSlots<T = unknown> {');
    expect(source).toContain(
      '[slot: `cell-${string}`]: ((props: CellContext<T>) => VNodeChild) | undefined;',
    );
    expect(source).toContain('"content":true');
    expect(source).toContain('export interface ArgusColumnSlots {');
  });
});

describe('emitVue', () => {
  const m = manifest();
  const source = emitVue([readElement(m, 'argus-table'), readElement(m, 'argus-column')]);

  test('describes each element for defineWrapper, with models and booleans', () => {
    expect(source).toContain("import { defineWrapper } from '../define.js';");
    expect(source).toContain(
      '{"name":"argus-sort-change","emit":"sort-change","model":{"property":"sorting","detailKey":"sorting"}}',
    );
    expect(source).toContain('{"name":"argus-row-click","emit":"row-click"}');
    expect(source).toContain('"methods":["refresh"]');
    expect(source).toContain('"props":["columnId","sortable","width"],"booleans":["sortable"]');
  });

  test('types handlers, v-model updates, emits and exposed methods', () => {
    expect(source).toContain("'onSort-change'?: (event: CustomEvent<SortChangeDetail>) => void;");
    expect(source).toContain(
      "'onUpdate:sorting'?: (value: ArgusTableElement<T>['sorting']) => void;",
    );
    expect(source).toContain(
      "(event: 'update:columnOrder', value: ArgusTableElement<T>['columnOrder']): void;",
    );
    expect(source).toContain("refresh: ArgusTableElement<T>['refresh'];");
    expect(source).toContain(') => VNode & { __ctx?: ArgusTableContext<T> };');
  });

  test('gives an element without events no event props or emits', () => {
    expect(source).not.toContain('ArgusColumnEventProps');
    expect(source).not.toContain('ArgusColumnEmit');
    expect(source).toContain('emit: (event: never) => void;');
  });
});

describe('emitAngular', () => {
  const m = manifest();
  const source = emitAngular([readElement(m, 'argus-table'), readElement(m, 'argus-column')]);

  test('puts a standalone component on each element tag', () => {
    expect(source).toContain("selector: 'argus-table',");
    expect(source).toContain("selector: 'argus-column',");
    expect(source).toContain('export class ArgusTableComponent<T = unknown> {');
    expect(source).toContain('export class ArgusColumnComponent {');
    expect(source).toContain("'(argus-sort-change)': 'handleSortChange($event)',");
  });

  test('types inputs, and lets attribute-backed ones take their HTML strings', () => {
    expect(source).toContain(
      "@Input() set data(value: ArgusTableElement<T>['data'] | null | undefined) {",
    );
    expect(source).toContain("setProperty(this.element, 'data', undefined, value);");
    expect(source).toContain(
      "@Input() set rowHeight(value: ArgusTableElement<T>['rowHeight'] | `${number}` | `${number}px` | null | undefined) {",
    );
    expect(source).toContain("setProperty(this.element, 'rowHeight', 'row-height', value);");
    expect(source).toContain(
      "@Input() set sortable(value: ArgusColumnElement['sortable'] | '' | 'true' | 'false' | null | undefined) {",
    );
    expect(source).toContain(
      "@Input() set width(value: ArgusColumnElement['width'] | `${number}` | `${number}px` | `${number}fr` | null | undefined) {",
    );
    expect(source).toContain('/** Sortable. */');
  });

  test('emits outputs, two-way …Change outputs and method proxies', () => {
    expect(source).toContain(
      '@Output() readonly sortChange = new EventEmitter<CustomEvent<SortChangeDetail>>();',
    );
    expect(source).toContain(
      "@Output() readonly sortingChange = new EventEmitter<ArgusTableElement<T>['sorting']>();",
    );
    expect(source).toContain('this.sortingChange.emit(e.detail.sorting);');
    expect(source).toContain('if (event.target !== this.element) return;');
    expect(source).toContain(
      "refresh(...args: Parameters<ArgusTableElement<T>['refresh']>): ReturnType<ArgusTableElement<T>['refresh']> {",
    );
  });
});
