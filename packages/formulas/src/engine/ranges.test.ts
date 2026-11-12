import { describe, expect, it } from 'vitest';
import { compile } from './compile.js';
import { FormulaError, isFormulaError } from './errors.js';
import { BUILTINS } from './functions/index.js';
import { inferType } from './infer.js';
import { parse } from './parse.js';
import { ColumnRange } from './range.js';

type Row = Record<string, unknown>;

const rows: Row[] = [
  { name: 'Ada', region: 'North', amount: 10, qty: 1, joined: new Date(2024, 0, 5) },
  { name: 'Ben', region: 'south', amount: 20, qty: '2', joined: new Date(2024, 2, 1) },
  { name: 'Cleo', region: 'North', amount: 30, qty: null, joined: new Date(2023, 5, 1) },
  { name: 'Dan', region: 'East', amount: 40.5, qty: 'n/a', joined: undefined },
  { name: 'Eve', region: 'North', amount: 20, qty: 3, joined: '2024-02-10' },
];

/** A compiled formula over `data`, whole columns read from `data` too. */
function compiled(formula: string, data: readonly Row[] = rows) {
  const ranges = new Map<string, ColumnRange>();
  return compile<Row>(parse(formula), {
    functions: BUILTINS,
    ref: (name) => (r) => r[name],
    range: (name) => () => {
      let range = ranges.get(name);
      if (!range) {
        range = new ColumnRange(data.map((r) => r[name]));
        ranges.set(name, range);
      }
      return range;
    },
  });
}

/** Evaluates a formula for each row; errors come back as their codes. */
function each(formula: string, data: readonly Row[] = rows): unknown[] {
  const evaluate = compiled(formula, data);
  return data.map((row) => {
    const value = evaluate(row);
    return isFormulaError(value) ? value.code : value;
  });
}

const first = (formula: string, data?: readonly Row[]) => each(formula, data)[0];

describe('totals over whole columns', () => {
  it.each([
    ['SUM([[amount]])', 120.5],
    ['SUM([[amount]], 1, [[qty]])', 127.5],
    ['MIN([[amount]])', 10],
    ['MAX([[amount]])', 40.5],
    ['AVERAGE([[amount]])', 24.1],
    // Text, booleans and blanks in a column are skipped; numeric text counts.
    ['SUM([[qty]])', 6],
    ['AVERAGE([[qty]])', 2],
    ['COUNT([[qty]])', 3],
    ['COUNTA([[qty]])', 4],
    ['COUNTBLANK([[joined]])', 1],
    ['COUNT([[qty]], 5, "x")', 4],
    ['SUM([[name]])', 0],
    ['AVERAGE([[name]])', '#DIV/0!'],
  ])('%s → %j', (formula, expected) => {
    expect(first(formula)).toBe(expected);
  });

  it('works per row against the whole column', () => {
    expect(each('[amount] / SUM([[amount]])').map((v) => Number(Number(v).toFixed(3)))).toEqual([
      0.083, 0.166, 0.249, 0.336, 0.166,
    ]);
  });

  it('passes on an error in the column', () => {
    const data = [{ amount: 1 }, { amount: new FormulaError('#NUM!', 'x') }];
    expect(first('SUM([[amount]])', data)).toBe('#NUM!');
    expect(first('COUNT([[amount]])', data)).toBe(1);
    expect(first('COUNTA([[amount]])', data)).toBe(2);
  });

  it('handles a million values (no spread into Math.min)', () => {
    const many = Array.from({ length: 1_000_000 }, (_, i) => ({ amount: i }));
    expect(each('MIN([[amount]]) + MAX([[amount]])', many.slice(0, 1))[0]).toBe(0);
    const evaluate = compiled('MAX([[amount]])', many);
    expect(evaluate(many[0] ?? {})).toBe(999_999);
  });
});

describe('a whole column where a value belongs', () => {
  it.each([
    '[[amount]]',
    '[[amount]] + 1',
    '-[[amount]]',
    '[[amount]] & "x"',
    '[[amount]] > 1',
    'ROUND([[amount]])',
    'IF(TRUE, [[amount]], 0)',
    'COUNTIF([[region]], [[region]])',
    'XLOOKUP("Ada", [name], [[amount]])',
  ])('%s is #VALUE!', (formula) => {
    expect(first(formula)).toBe('#VALUE!');
  });

  it('may pass through IF into a function that takes it', () => {
    expect(first('SUM(IF([amount] > 15, [[amount]], [[qty]]))')).toBe(6);
    expect(each('SUM(IF([amount] > 15, [[amount]], [[qty]]))')[1]).toBe(120.5);
  });

  it('is #N/A without a way to read whole columns', () => {
    const evaluate = compile<Row>(parse('SUM([[amount]])'), {
      functions: BUILTINS,
      ref: () => () => 1,
    });
    expect((evaluate({}) as FormulaError).code).toBe('#N/A');
  });
});

describe('row-independent parts are computed once', () => {
  it('evaluates SUM([[x]]) once for every row', () => {
    let reads = 0;
    const range = new ColumnRange([1, 2, 3]);
    const sum = BUILTINS.SUM;
    const evaluate = compile<Row>(parse('[a] / SUM([[a]])'), {
      functions: {
        ...BUILTINS,
        SUM: {
          ...sum,
          min: 1,
          max: Infinity,
          returns: 'number',
          ranges: true,
          fn: (...args) => {
            reads++;
            return sum?.fn?.(...args);
          },
        },
      },
      ref: (name) => (r) => r[name],
      range: () => () => range,
    });
    expect([1, 2, 3].map((a) => evaluate({ a }))).toEqual([1 / 6, 2 / 6, 3 / 6]);
    expect(reads).toBe(1);
  });

  it('runs [a] / SUM([[a]]) over 200k rows in well under a second', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => ({ a: i % 100 }));
    const evaluate = compiled('[a] / SUM([[a]])', many);
    const started = performance.now();
    for (const row of many) evaluate(row);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('conditional totals', () => {
  it.each([
    ['COUNTIF([[region]], "north")', 3],
    ['COUNTIF([[region]], "<>North")', 2],
    ['COUNTIF([[amount]], ">20")', 2],
    ['COUNTIF([[amount]], ">=20")', 4],
    ['COUNTIF([[amount]], "<20")', 1],
    ['COUNTIF([[amount]], "<=20")', 3],
    ['COUNTIF([[amount]], 20)', 2],
    ['COUNTIF([[amount]], "20")', 2],
    ['COUNTIF([[name]], "?e*")', 1],
    ['COUNTIF([[name]], "*a*")', 2],
    ['COUNTIF([[name]], "<>*a*")', 3],
    ['COUNTIF([[name]], "<c")', 2],
    ['COUNTIF([[qty]], "")', 1],
    ['COUNTIF([[qty]], "<>")', 4],
    ['COUNTIF([[joined]], ">2024-01-31")', 2],
    ['COUNTIF([[joined]], "2024-02-10")', 1],
    ['SUMIF([[region]], "North", [[amount]])', 60],
    ['SUMIF([[amount]], ">15")', 110.5],
    ['SUMIF([[region]], "<>north", [[amount]])', 60.5],
    ['SUMIF([[amount]], "<=20", [[qty]])', 6],
    ['AVERAGEIF([[region]], "North", [[amount]])', 20],
    ['AVERAGEIF([[region]], "West", [[amount]])', '#DIV/0!'],
    ['AVERAGEIF([[amount]], ">15", [[amount]])', 27.625],
  ])('%s → %j', (formula, expected) => {
    expect(first(formula)).toBe(expected);
  });

  it('takes a criterion from the row', () => {
    expect(each('COUNTIF([[region]], [region])')).toEqual([3, 1, 3, 1, 3]);
    expect(each('SUMIF([[region]], [region], [[amount]])')).toEqual([60, 20, 60, 40.5, 60]);
    expect(each('COUNTIF([[amount]], ">" & [amount])')).toEqual([4, 2, 1, 0, 2]);
    expect(each('SUMIF([[amount]], "<" & [amount])')).toEqual([0, 10, 50, 80, 10]);
  });

  it('needs a whole column for its range', () => {
    expect(first('COUNTIF([region], "North")')).toBe('#VALUE!');
    expect(first('SUMIF([[region]], "North", 5)')).toBe('#VALUE!');
  });

  it('returns an error among the rows summed, not among the others', () => {
    const data = [
      { k: 'a', v: 1 },
      { k: 'b', v: new FormulaError('#NUM!', 'x') },
      { k: 'a', v: 2 },
    ];
    expect(first('SUMIF([[k]], "a", [[v]])', data)).toBe(3);
    expect(first('SUMIF([[k]], "b", [[v]])', data)).toBe('#NUM!');
    expect(first('SUMIF([[k]], "<>a", [[v]])', data)).toBe('#NUM!');
    expect(first('COUNTIF([[k]], "<>a")', data)).toBe(1);
  });

  it('adds up decimals without the noise of running totals', () => {
    const data = [0.1, 0.2, 0.3, 1e9 + 0.7].map((v) => ({ v }));
    expect(first('SUMIF([[v]], "<1")', data)).toBe(0.1 + 0.2 + 0.3);
    expect(first('SUMIF([[v]], "<>0.1")', data)).toBe(0.2 + 0.3 + (1e9 + 0.7));
  });

  it('stays fast with a criterion from each of 100k rows', () => {
    const many = Array.from({ length: 100_000 }, (_, i) => ({ c: `c${String(i % 500)}`, n: i }));
    const started = performance.now();
    const counts = each('COUNTIF([[c]], [c]) + COUNTIF([[n]], "<" & [n])', many);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(counts[0]).toBe(200);
    expect(counts[99_999]).toBe(200 + 99_999);
  });
});

describe('lookups', () => {
  it.each([
    ['XLOOKUP("cleo", [[name]], [[amount]])', 30],
    ['XLOOKUP("Zed", [[name]], [[amount]])', '#N/A'],
    ['XLOOKUP("Zed", [[name]], [[amount]], "—")', '—'],
    ['XLOOKUP(20, [[amount]], [[name]])', 'Ben'],
    ['XLOOKUP("20", [[amount]], [[name]])', 'Ben'],
    ['MATCH("Dan", [[name]], 0)', 4],
    ['MATCH("Dan", [[region]], 0)', '#N/A'],
    ['MATCH("Bob", [[name]])', 2],
    ['MATCH("Ada", [[name]])', 1],
    ['MATCH("Ab", [[name]])', '#N/A'],
    ['MATCH(25, [[amount]], 1)', 2],
    ['INDEX([[name]], 2)', 'Ben'],
    ['INDEX([[name]], 2.9)', 'Ben'],
    ['INDEX([[name]], 6)', '#REF!'],
    ['INDEX([[name]], 0)', '#REF!'],
    ['INDEX([[name]], MATCH(MAX([[amount]]), [[amount]], 0))', 'Dan'],
  ])('%s → %j', (formula, expected) => {
    expect(first(formula)).toBe(expected);
  });

  it('looks up a value of each row', () => {
    const people = [
      { id: 1, name: 'Ada', manager: undefined },
      { id: 2, name: 'Ben', manager: 1 },
      { id: 3, name: 'Cleo', manager: 2 },
    ];
    expect(each('XLOOKUP([manager], [[id]], [[name]], "—")', people)).toEqual(['—', 'Ada', 'Ben']);
  });

  it('matches descending data with type -1', () => {
    const data = [50, 40, 30].map((v) => ({ v }));
    expect(first('MATCH(45, [[v]], -1)', data)).toBe(1);
    expect(first('MATCH(30, [[v]], -1)', data)).toBe(3);
  });
});

describe('RANK', () => {
  it('ranks descending by default, ties sharing the best rank', () => {
    expect(each('RANK([amount], [[amount]])')).toEqual([5, 3, 2, 1, 3]);
    expect(each('RANK([amount], [[amount]], TRUE)')).toEqual([1, 2, 4, 5, 2]);
  });

  it('is #N/A for a value not in the column', () => {
    expect(first('RANK(11, [[amount]])')).toBe('#N/A');
  });
});

describe('types', () => {
  const type = (formula: string) =>
    inferType(parse(formula), BUILTINS, (name) => (name === 'when' ? 'date' : 'unknown'));

  it('takes INDEX and XLOOKUP results from their column', () => {
    expect(type('INDEX([[when]], 1)')).toBe('date');
    expect(type('XLOOKUP(1, [[id]], [[when]])')).toBe('date');
    expect(type('COUNTIF([[when]], ">1")')).toBe('number');
    expect(type('RANK(1, [[x]])')).toBe('number');
  });
});
