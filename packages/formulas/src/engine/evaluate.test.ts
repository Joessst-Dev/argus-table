import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compile } from './compile.js';
import { FormulaError, FormulaSyntaxError, isFormulaError } from './errors.js';
import { BUILTINS } from './functions/index.js';
import { inferType } from './infer.js';
import { parse } from './parse.js';

type Row = Record<string, unknown>;

/** Evaluates a formula against one row; an error comes back as its code. */
function run(formula: string, row: Row = {}): unknown {
  const evaluate = compile<Row>(parse(formula), {
    functions: BUILTINS,
    ref: (name) =>
      name in row ? (r) => r[name] : new FormulaError('#REF!', `There is no column [${name}].`),
  });
  const value = evaluate(row);
  return isFormulaError(value) ? value.code : value;
}

describe('operators', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['7 / 2', 3.5],
    ['2 ^ 10', 1024],
    ['-2 ^ 2', 4],
    ['2 ^ 3 ^ 2', 64],
    ['50%', 0.5],
    ['200 * 5%', 10],
    ['-[a]', -3],
    ['+[s]', 'x'],
    ['1 / 0', '#DIV/0!'],
    ['0 ^ 0', '#NUM!'],
    ['(-8) ^ 0.5', '#NUM!'],
    ['10 ^ 400', '#NUM!'],
    ['0 * -1', 0],
  ])('%s → %j', (formula, expected) => {
    expect(run(formula, { a: 3, s: 'x' })).toBe(expected);
  });

  it('turns numeric text, booleans and blanks into numbers', () => {
    const row = { text: ' 12.5 ', yes: true, none: null, empty: '', missing: undefined };
    expect(run('[text] * 2', row)).toBe(25);
    expect(run('[yes] + 1', row)).toBe(2);
    expect(run('[none] + [empty] + [missing] + 1', row)).toBe(1);
  });

  it('gives #VALUE! for text, dates and objects in arithmetic', () => {
    const row = { word: 'abc', date: new Date(2024, 0, 1), object: { a: 1 }, space: ' ' };
    expect(run('[word] + 1', row)).toBe('#VALUE!');
    expect(run('[date] + 1', row)).toBe('#VALUE!');
    expect(run('[object] * 1', row)).toBe('#VALUE!');
    expect(run('[space] * 1', row)).toBe('#VALUE!');
  });

  it('joins text with &, writing numbers, booleans and dates as text', () => {
    expect(run('"n=" & 0.1 + 0.2', {})).toBe('n=0.3');
    expect(run('[a] & "-" & TRUE & "-" & [none]', { a: 1.5, none: null })).toBe('1.5-TRUE-');
    expect(run('"" & [d]', { d: new Date(2024, 2, 9) })).toBe('2024-03-09');
    expect(run('"" & [d]', { d: new Date(2024, 2, 9, 14, 5) })).toBe('2024-03-09 14:05:00');
  });

  it.each([
    ['1 < 2', true],
    ['2 <= 2', true],
    ['3 <> 3', false],
    ['"abc" = "ABC"', true],
    ['"a" < "b"', true],
    ['FALSE < TRUE', true],
    // Numbers < text < booleans.
    ['9 < "1"', true],
    ['"z" < FALSE', true],
    // A blank matches 0, "" and FALSE.
    ['[none] = 0', true],
    ['[none] = ""', true],
    ['[none] = FALSE', true],
    ['[d1] < [d2]', true],
    ['[d1] = [d1copy]', true],
    ['1 < [obj]', '#VALUE!'],
  ])('%s → %j', (formula, expected) => {
    const row = {
      none: null,
      d1: new Date(2024, 0, 1),
      d1copy: new Date(2024, 0, 1),
      d2: new Date(2024, 0, 2),
      obj: {},
    };
    expect(run(formula, row)).toBe(expected);
  });

  it('passes errors on, the left one first', () => {
    expect(run('[x] + 1 / 0', {})).toBe('#REF!');
    expect(run('1 / 0 & [x]', {})).toBe('#DIV/0!');
    expect(run('-(1 / 0)', {})).toBe('#DIV/0!');
    expect(run('(1 / 0)%', {})).toBe('#DIV/0!');
    expect(run('(1 / 0) = 1', {})).toBe('#DIV/0!');
    expect(run('ROUND(1 / 0, [x])', {})).toBe('#DIV/0!');
  });
});

describe('functions', () => {
  it('calls functions in any case and reports unknown ones as #NAME?', () => {
    expect(run('sum(1, 2)')).toBe(3);
    expect(run('NOPE(1)')).toBe('#NAME?');
  });

  it('checks the number of arguments when compiling', () => {
    const arity = (formula: string) => () =>
      compile(parse(formula), { functions: BUILTINS, ref: () => () => 1 });
    expect(arity('ROUND()')).toThrow(new FormulaSyntaxError('ROUND takes 1 to 2 arguments.', 0, 7));
    expect(arity('ABS(1, 2)')).toThrow('ABS takes 1 argument.');
    expect(arity('MOD(1)')).toThrow('MOD takes 2 arguments.');
    expect(arity('SUM()')).toThrow('SUM takes at least 1 argument.');
    expect(arity('TODAY(1)')).toThrow('TODAY takes 0 arguments.');
  });

  describe('math', () => {
    it.each([
      ['SUM(1, 2, 3)', 6],
      ['SUM([a], [none], [text])', 5],
      ['SUM([none])', 0],
      ['MIN(3, [none], 1)', 1],
      ['MAX(3, [none], 1)', 3],
      ['MIN([none])', 0],
      ['AVERAGE(1, 2, [none], 6)', 3],
      ['AVERAGE([none])', '#DIV/0!'],
      ['SUM(1, "x")', '#VALUE!'],
      ['ROUND(2.5)', 3],
      ['ROUND(-2.5)', -3],
      ['ROUND(1.005, 2)', 1.01],
      ['ROUND(1234.5, -2)', 1200],
      ['ROUND(-0.4)', 0],
      ['ROUNDUP(1.21, 1)', 1.3],
      ['ROUNDUP(-1.21, 1)', -1.3],
      ['ROUNDDOWN(1.29, 1)', 1.2],
      ['ROUNDDOWN(-1.29, 1)', -1.2],
      ['ABS(-4)', 4],
      ['INT(-1.5)', -2],
      ['INT(1.9)', 1],
      ['MOD(7, 3)', 1],
      ['MOD(-3, 2)', 1],
      ['MOD(3, -2)', -1],
      ['MOD(1, 0)', '#DIV/0!'],
      ['POWER(2, 3)', 8],
      ['POWER(0, -1)', '#NUM!'],
      ['SQRT(16)', 4],
      ['SQRT(-1)', '#NUM!'],
    ])('%s → %j', (formula, expected) => {
      expect(run(formula, { a: 2, none: null, text: '3' })).toBe(expected);
    });
  });

  describe('logic', () => {
    it.each([
      ['IF(1 > 0, "yes", "no")', 'yes'],
      ['IF(0, "yes", "no")', 'no'],
      ['IF(FALSE, 1)', false],
      ['IF("TRUE", 1, 2)', 1],
      ['IF("maybe", 1, 2)', '#VALUE!'],
      ['IF(1 / 0, 1, 2)', '#DIV/0!'],
      // Only the branch taken is evaluated.
      ['IF(TRUE, 1, 1 / 0)', 1],
      ['IFS([a] > 5, "high", [a] > 1, "mid", TRUE, "low")', 'mid'],
      ['IFS([a] > 5, "high")', '#N/A'],
      ['IFS(TRUE, 1, FALSE)', '#VALUE!'],
      ['AND(TRUE, 1, "true")', true],
      ['AND(TRUE, 0)', false],
      ['AND(FALSE, 1 / 0)', false],
      ['AND(TRUE, 1 / 0)', '#DIV/0!'],
      ['AND([none])', '#VALUE!'],
      ['AND([none], TRUE)', true],
      ['OR(FALSE, 0)', false],
      ['OR(FALSE, 2)', true],
      ['OR(TRUE, 1 / 0)', true],
      ['NOT(0)', true],
      ['NOT("x")', '#VALUE!'],
      ['IFERROR(1 / 0, "n/a")', 'n/a'],
      ['IFERROR([a], "n/a")', 2],
      ['IFERROR([gone], 0)', 0],
      ['ISBLANK([none])', true],
      ['ISBLANK("")', true],
      ['ISBLANK(0)', false],
      ['ISBLANK(1 / 0)', false],
    ])('%s → %j', (formula, expected) => {
      expect(run(formula, { a: 2, none: null })).toBe(expected);
    });
  });

  describe('text', () => {
    it.each([
      ['CONCAT([first], " ", [last])', 'Ada Lovelace'],
      ['CONCAT("n", 1, TRUE, [none])', 'n1TRUE'],
      ['LEFT("abc")', 'a'],
      ['LEFT("abc", 2)', 'ab'],
      ['LEFT("abc", 10)', 'abc'],
      ['LEFT("abc", -1)', '#VALUE!'],
      ['RIGHT("abc", 2)', 'bc'],
      ['RIGHT("abc", 0)', ''],
      ['MID("abcdef", 2, 3)', 'bcd'],
      ['MID("abc", 0, 1)', '#VALUE!'],
      ['LEN("héllo👋")', 6],
      ['LEN([none])', 0],
      ['LEFT("👋x", 1)', '👋'],
      ['UPPER("abc")', 'ABC'],
      ['LOWER("ABC")', 'abc'],
      ['TRIM("  a   b  ")', 'a b'],
    ])('%s → %j', (formula, expected) => {
      expect(run(formula, { first: 'Ada', last: 'Lovelace', none: null })).toBe(expected);
    });

    it.each([
      ['TEXT(1234.567, "0.00")', '1234.57'],
      ['TEXT(1234.567, "#,##0.00")', '1,234.57'],
      ['TEXT(1234567, "#,##0")', '1,234,567'],
      ['TEXT(0.256, "0%")', '26%'],
      ['TEXT(0.256, "0.0%")', '25.6%'],
      ['TEXT(5, "000")', '005'],
      ['TEXT(1.5, "0.##")', '1.5'],
      ['TEXT(2, "0.##")', '2'],
      ['TEXT(0.5, "#.##")', '.5'],
      ['TEXT(-1234.5, "#,##0.0")', '-1,234.5'],
      ['TEXT(-0.001, "0.00")', '0.00'],
      ['TEXT(9.99, """€ ""0.00")', '€ 9.99'],
      ['TEXT(3, "0 ""pcs""")', '3 pcs'],
      ['TEXT("x", "0.00")', '#VALUE!'],
      ['TEXT(1, "abc")', '#VALUE!'],
      ['TEXT([d], "yyyy-mm-dd")', '2024-03-09'],
      ['TEXT([d], "d.m.yy")', '9.3.24'],
      ['TEXT([d], "mmm d, yyyy")', 'Mar 9, 2024'],
      ['TEXT([d], "mmmm")', 'March'],
      ['TEXT([d], "hh:mm:ss")', '14:05:07'],
      ['TEXT([d], "h:mm AM/PM")', '2:05 PM'],
      ['TEXT("2024-03-09", "dd/mm/yyyy")', '09/03/2024'],
      ['TEXT("soon", "yyyy")', '#VALUE!'],
    ])('%s → %j', (formula, expected) => {
      expect(run(formula, { d: new Date(2024, 2, 9, 14, 5, 7) })).toBe(expected);
    });
  });

  describe('date', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 2, 9, 15, 30));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('TODAY is today at midnight', () => {
      expect(run('TODAY()')).toEqual(new Date(2024, 2, 9));
    });

    it.each([
      ['YEAR([d])', 2023],
      ['MONTH([d])', 12],
      ['DAY([d])', 31],
      ['YEAR("2020-02-29")', 2020],
      ['DAY("2020-02-29")', 29],
      ['YEAR("2021-02-29")', '#VALUE!'],
      ['YEAR("2020-02-29T10:00:00Z")', 2020],
      ['YEAR(2020)', '#VALUE!'],
      ['YEAR([none])', '#VALUE!'],
      ['DAYS(TODAY(), [d])', 69],
      ['DAYS("2024-03-31", "2024-03-30")', 1],
      ['DAYS("2024-01-01", "2024-01-31")', -30],
      ['DATEDIF("2020-05-15", "2024-03-09", "Y")', 3],
      ['DATEDIF("2020-05-15", "2024-03-09", "M")', 45],
      ['DATEDIF("2020-05-15", "2024-03-09", "D")', 1394],
      ['DATEDIF("2020-05-15", "2024-03-09", "YM")', 9],
      ['DATEDIF("2020-05-15", "2024-03-09", "MD")', 23],
      ['DATEDIF("2020-05-15", "2024-03-09", "YD")', 299],
      ['DATEDIF("2024-01-31", "2024-03-01", "MD")', 1],
      ['DATEDIF("2024-03-09", "2020-05-15", "D")', '#NUM!'],
      ['DATEDIF("2020-05-15", "2024-03-09", "W")', '#NUM!'],
    ])('%s → %j', (formula, expected) => {
      expect(run(formula, { d: new Date(2023, 11, 31), none: null })).toBe(expected);
    });
  });
});

describe('inferType', () => {
  const type = (formula: string, refs: Record<string, 'number' | 'text'> = {}) =>
    inferType(parse(formula), BUILTINS, (name) => refs[name] ?? 'unknown');

  it.each([
    ['[a] * [b]', 'number'],
    ['-[a]', 'number'],
    ['+[a]', 'unknown'],
    ['[a]%', 'number'],
    ['[a] & ""', 'text'],
    ['[a] > 1', 'boolean'],
    ['"x"', 'text'],
    ['TRUE', 'boolean'],
    ['ROUND([a], 2)', 'number'],
    ['LEN([a])', 'number'],
    ['UPPER([a])', 'text'],
    ['TODAY()', 'date'],
    ['DAYS(TODAY(), [a])', 'number'],
    ['ISBLANK([a])', 'boolean'],
    ['IF([a], 1, 2)', 'number'],
    ['IF([a], 1, "x")', 'unknown'],
    ['IF([a], 1)', 'number'],
    ['IFERROR([a] / [b], 0)', 'number'],
    ['IFS([a], 1, [b], 2)', 'number'],
    ['NOPE()', 'unknown'],
    ['[a]', 'unknown'],
  ])('%s → %s', (formula, expected) => {
    expect(type(formula)).toBe(expected);
  });

  it('asks for the type of named columns', () => {
    expect(type('[total]', { total: 'number' })).toBe('number');
    expect(type('IF([x], [total], 0)', { total: 'number' })).toBe('number');
  });
});
