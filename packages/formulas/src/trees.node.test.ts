import { describe, expect, it } from 'vitest';
import type { ColumnDef } from 'argus-table';
import { compileColumns, functionTable, parseOrError } from './columns.js';
import { treesOf } from './trees.js';

const functions = functionTable({ vat: { fn: (n) => Number(n) * 0.19, args: [1, 1] } });

const dataColumns: ColumnDef[] = [
  { id: 'price', header: 'Unit price', accessor: 'price' },
  { id: 'qty', header: 'Quantity', accessor: 'qty' },
  { id: 'w', header: () => 'Weight', accessor: 'w' },
];

/** The trees of formula columns given by id, after the data columns. */
function trees(formulas: Record<string, string>) {
  const defs: ColumnDef[] = [
    ...dataColumns,
    ...Object.entries(formulas).map(([id, formula]) => ({ id, formula })),
  ];
  const compiled = compileColumns(defs, { functions, parse: parseOrError });
  return treesOf(defs, compiled, { parse: parseOrError, functions });
}

const ref = (column: string) => ({ type: 'ref', column });

describe('treesOf', () => {
  it('turns a formula into a tree with column ids and no spans', () => {
    expect(trees({ total: '[price] * [Quantity]' })).toEqual({
      total: { type: 'binary', operator: '*', left: ref('price'), right: ref('qty') },
    });
  });

  it.each([
    ['[unit price]', 'price'],
    ['[QTY]', 'qty'],
    ['[weight]', 'w'],
  ])('resolves %s to %s', (formula, id) => {
    expect(trees({ f: formula }).f).toEqual(ref(id));
  });

  it('keeps literals, calls, unary minus and percent', () => {
    expect(trees({ f: 'IF([qty] > 0, "yes", TRUE)' }).f).toEqual({
      type: 'call',
      name: 'IF',
      args: [
        { type: 'binary', operator: '>', left: ref('qty'), right: { type: 'number', value: 0 } },
        { type: 'text', value: 'yes' },
        { type: 'boolean', value: true },
      ],
    });
    expect(trees({ f: '-[price]' }).f).toEqual({
      type: 'unary',
      operator: '-',
      operand: ref('price'),
    });
    expect(trees({ f: '[price]%' }).f).toEqual({ type: 'percent', operand: ref('price') });
    expect(trees({ f: 'vat([price])' }).f).toEqual({
      type: 'call',
      name: 'VAT',
      args: [ref('price')],
    });
  });

  it('keeps a reference to another formula column as a ref', () => {
    expect(trees({ total: '[price] * [qty]', twice: '[total] * 2' }).twice).toEqual({
      type: 'binary',
      operator: '*',
      left: ref('total'),
      right: { type: 'number', value: 2 },
    });
  });

  it.each([
    ['a formula that does not parse', '[price] *'],
    ['an unknown column', '[Nope]'],
    ['an unknown function', 'NOPE(1)'],
    ['the wrong number of arguments', 'ROUND()'],
    ['a whole column', '[price] / SUM([[price]])'],
  ])('leaves out %s', (_, formula) => {
    expect(trees({ f: formula })).toEqual({});
  });

  it('leaves out cycles, and columns reading a left-out column', () => {
    expect(trees({ a: '[b]', b: '[a]' })).toEqual({});
    const result = trees({
      share: 'SUM([[price]])',
      pct: '[share] * 100',
      bad: '[price] *',
      next: '[bad] + 1',
      ok: '[qty]',
    });
    expect(Object.keys(result)).toEqual(['ok']);
  });

  it('gives plain JSON', () => {
    const result = trees({ total: '[price] * [qty]' });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
