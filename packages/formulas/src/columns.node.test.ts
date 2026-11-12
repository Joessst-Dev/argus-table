import { describe, expect, it } from 'vitest';
import type { ColumnDef } from 'argus-table';
import {
  compileColumns,
  functionTable,
  lookupOf,
  parseOrError,
  type RowSource,
} from './columns.js';
import { isFormulaError } from './engine/errors.js';
import { checkFormula, noteOn } from './editor/session.js';

const functions = functionTable();

const defs = (formula: string, more: ColumnDef[] = []): ColumnDef[] => [
  { id: 'price', header: 'Unit price', accessor: 'price' },
  { id: 'qty', header: 'Quantity', accessor: 'qty' },
  ...more,
  { id: 'draft', header: 'Draft', formula },
];

describe('checkFormula', () => {
  it.each([
    ['[price] * [Quantity]', undefined],
    ['ROUND([Unit price], 2)', undefined],
    ['[price] *', { message: 'The formula ends too early.', start: 9, end: 10 }],
    ['[price] * [Weight]', { message: 'There is no column [Weight].', start: 10, end: 18 }],
    ['1 + nope(2)', { message: 'There is no function NOPE.', start: 4, end: 8 }],
    ['ROUND()', { message: 'ROUND takes 1 to 2 arguments.', start: 0, end: 7 }],
    ['[Draft] + 1', { message: 'The formula depends on its own result.', start: 0, end: 11 }],
    ['SUM([[price]])', undefined],
    ['SUM([[Weight]])', { message: 'There is no column [[Weight]].', start: 4, end: 14 }],
    ['SUM([[Draft]])', { message: 'The formula depends on its own result.', start: 0, end: 14 }],
  ])('%s', (formula, expected) => {
    expect(checkFormula(defs(formula), 'draft', functions)).toEqual(expected);
  });

  it('finds a cycle through another formula column', () => {
    const other: ColumnDef = { id: 'other', header: 'Other', formula: '[Draft] * 2' };
    expect(checkFormula(defs('[Other] + 1', [other]), 'draft', functions)?.message).toBe(
      'The formula depends on its own result.',
    );
  });
});

describe('lookupOf', () => {
  it('finds a column by id, then text header, then id in any case', () => {
    const lookup = lookupOf<unknown>([
      { id: 'a', header: 'B' },
      { id: 'b', header: 'Other' },
      { id: 'Mixed' },
    ]);
    expect(lookup('b')?.header).toBe('Other');
    expect(lookup('B ')).toBeUndefined();
    expect(lookup('other')?.id).toBe('b');
    expect(lookup('mixed')?.id).toBe('Mixed');
  });
});

describe('compileColumns', () => {
  it('keeps a compiled column while its formula and inputs stay the same', () => {
    const columns = defs('[price] * [qty]');
    const first = compileColumns(columns, { functions, parse: parseOrError });
    const again = compileColumns([...columns], {
      functions,
      parse: parseOrError,
      previous: first,
    });
    expect(again.get('draft')).toBe(first.get('draft'));
    const changed = compileColumns(defs('[price] + [qty]'), {
      functions,
      parse: parseOrError,
      previous: first,
    });
    expect(changed.get('draft')).not.toBe(first.get('draft'));
    expect(changed.get('draft')?.result({ price: 2, qty: 3 }, 0)).toBe(5);
  });

  it('reports formulas that can’t be read or compiled', () => {
    const broken: string[] = [];
    compileColumns(defs('ROUND()', [{ id: 'bad', formula: '1 +' }]), {
      functions,
      parse: parseOrError,
      onBroken: (def, error) => broken.push(`${def.id}: ${error.message}`),
    });
    expect(broken.sort()).toEqual([
      'bad: The formula ends too early.',
      'draft: ROUND takes 1 to 2 arguments.',
    ]);
  });
});

describe('noteOn', () => {
  it('notes a total of one value of the row', () => {
    expect(noteOn('[qty] / SUM([qty])')).toBe(
      'SUM([qty]) uses one value, the row’s own. For the whole column, write [[qty]].',
    );
    expect(noteOn('SUM([[qty]])')).toBeUndefined();
    expect(noteOn('SUM([a], [b])')).toBeUndefined();
    expect(noteOn('SUM([a')).toBeUndefined();
  });
});

describe('compileColumns with whole columns', () => {
  interface Item {
    group: string;
    n: number;
  }
  const items: Item[] = [
    { group: 'a', n: 1 },
    { group: 'b', n: 2 },
    { group: 'a', n: 3 },
    { group: 'c', n: 4 },
  ];
  const columns: ColumnDef<Item>[] = [
    { id: 'group', accessor: 'group' },
    { id: 'n', accessor: 'n' },
    { id: 'double', formula: '[n] * 2' },
    { id: 'share', formula: '[double] / SUM([[double]])' },
    { id: 'pct', formula: 'ROUND([share] * 100)' },
  ];
  /** A source over `items` keeping `keep`, recording what it was asked. */
  const source = (keep: readonly number[], asked: string[][] = []): RowSource<Item> => ({
    data: () => items,
    indexes: (except) => {
      asked.push([...except]);
      return keep;
    },
  });
  const values = (compiled: ReturnType<typeof compileColumns<Item>>, id: string) =>
    items.map((row, i) => {
      const value = compiled.get(id)?.result(row, i);
      return isFormulaError(value) ? value.code : value;
    });

  it('computes over the rows of the source, leaving out the columns using them', () => {
    const asked: string[][] = [];
    const compiled = compileColumns(columns, {
      functions,
      parse: parseOrError,
      rows: source([0, 1, 2], asked),
    });
    // 2 + 4 + 6 = 12.
    expect(values(compiled, 'pct')).toEqual([17, 33, 50, 67]);
    expect(asked).toEqual([['pct', 'share']]);
    expect(compiled.get('share')?.ranges).toBe(true);
    expect(compiled.get('pct')?.ranges).toBe(true);
    expect(compiled.get('double')?.ranges).toBe(false);
  });

  it('computes again only the columns using them, for a new source', () => {
    const rows = source([0]);
    const first = compileColumns(columns, { functions, parse: parseOrError, rows });
    const same = compileColumns([...columns], {
      functions,
      parse: parseOrError,
      previous: first,
      rows,
    });
    expect(same.get('share')).toBe(first.get('share'));
    const next = compileColumns(columns, {
      functions,
      parse: parseOrError,
      previous: first,
      rows: source([0, 1]),
    });
    expect(next.get('double')).toBe(first.get('double'));
    expect(next.get('share')).not.toBe(first.get('share'));
    expect(values(next, 'share')).toEqual([1 / 3, 2 / 3, 1, 4 / 3]);
  });

  it('are #N/A without rows, and a whole column of itself is a cycle', () => {
    const none = compileColumns(columns, {
      functions,
      parse: parseOrError,
      rows: { data: () => items, indexes: () => undefined },
    });
    expect(values(none, 'share')).toEqual(['#N/A', '#N/A', '#N/A', '#N/A']);
    const cycle = compileColumns([...columns, { id: 'loop', formula: 'SUM([[loop]])' }], {
      functions,
      parse: parseOrError,
    });
    expect(values(cycle, 'loop')[0]).toBe('#CYCLE!');
  });
});
