import { describe, expect, it } from 'vitest';
import type { ColumnDef } from 'argus-table';
import { compileColumns, functionTable, lookupOf, parseOrError } from './columns.js';
import { checkFormula } from './editor/session.js';

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
