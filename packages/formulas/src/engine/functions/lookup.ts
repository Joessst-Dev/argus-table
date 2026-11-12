import { checkNumber, compare, toBoolean, toNumber } from '../coerce.js';
import { parseCriterion } from '../criteria.js';
import { DIV0, FormulaError, isFormulaError } from '../errors.js';
import { isRange, type ColumnRange } from '../range.js';
import { countBelow, firstIndexOf, sortedNumbers, statsOf } from '../range-index.js';
import type { FunctionDef, FunctionTable } from './types.js';

const notFound = (name: string) => new FormulaError('#N/A', `${name} found no match.`);

/** A whole column where one is needed, or the error saying so. */
function rangeArg(name: string, value: unknown): ColumnRange | FormulaError {
  return isRange(value)
    ? value
    : new FormulaError('#VALUE!', `${name} needs a whole column ([[name]]) here.`);
}

/** `SUMIF`, `COUNTIF`, `AVERAGEIF`: the rows of a range meeting a criterion. */
function conditional(
  name: string,
  max: number,
  result: (s: { matches: number; sum: number; numbers: number }) => unknown,
  count = false,
): FunctionDef {
  return {
    min: 2,
    max,
    returns: 'number',
    ranges: true,
    fn: (rangeValue, criterion, sumValue) => {
      const range = rangeArg(name, rangeValue);
      if (isFormulaError(range)) return range;
      if (isRange(criterion)) return rangeArg(name, undefined);
      const sum = sumValue === undefined ? range : rangeArg(name, sumValue);
      if (isFormulaError(sum)) return sum;
      const stats = statsOf(range, parseCriterion(criterion), sum, count);
      if (!count && stats.error) return stats.error;
      return result(stats);
    },
  };
}

const xlookup: FunctionDef = {
  min: 3,
  max: 4,
  returns: 'unknown',
  returnsFrom: 2,
  ranges: true,
  fn: (value, rangeValue, resultValue, ...fallback) => {
    if (isRange(value)) return rangeArg('XLOOKUP', undefined);
    const range = rangeArg('XLOOKUP', rangeValue);
    if (isFormulaError(range)) return range;
    const result = rangeArg('XLOOKUP', resultValue);
    if (isFormulaError(result)) return result;
    const at = firstIndexOf(range, value);
    if (at !== undefined) return result.values[at];
    return fallback.length ? fallback[0] : notFound('XLOOKUP');
  },
};

/** The last position whose value is at most (`descending`: at least) `value`, assuming the range is in that order. */
function approximate(range: ColumnRange, value: unknown, descending: boolean): number | undefined {
  let lo = 0;
  let hi = range.values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const order = compare(range.values[mid], value);
    const before = isFormulaError(order) ? false : descending ? order >= 0 : order <= 0;
    if (before) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? lo - 1 : undefined;
}

const match: FunctionDef = {
  min: 2,
  max: 3,
  returns: 'number',
  ranges: true,
  fn: (value, rangeValue, typeValue = 1) => {
    if (isRange(value)) return rangeArg('MATCH', undefined);
    const range = rangeArg('MATCH', rangeValue);
    if (isFormulaError(range)) return range;
    const type = toNumber(typeValue);
    if (isFormulaError(type)) return type;
    const at = type === 0 ? firstIndexOf(range, value) : approximate(range, value, type < 0);
    return at === undefined ? notFound('MATCH') : at + 1;
  },
};

const index: FunctionDef = {
  min: 2,
  max: 2,
  returns: 'unknown',
  returnsFrom: 0,
  ranges: true,
  fn: (rangeValue, position) => {
    const range = rangeArg('INDEX', rangeValue);
    if (isFormulaError(range)) return range;
    const n = toNumber(position);
    if (isFormulaError(n)) return n;
    const at = Math.trunc(n);
    if (at < 1 || at > range.values.length) {
      return new FormulaError('#REF!', `INDEX: there is no row ${String(at)} in the column.`);
    }
    return range.values[at - 1];
  },
};

const rank: FunctionDef = {
  min: 2,
  max: 3,
  returns: 'number',
  ranges: true,
  fn: (value, rangeValue, ascendingValue = false) => {
    const range = rangeArg('RANK', rangeValue);
    if (isFormulaError(range)) return range;
    const n = toNumber(value);
    if (isFormulaError(n)) return n;
    const ascending = toBoolean(ascendingValue);
    if (isFormulaError(ascending)) return ascending;
    const numbers = sortedNumbers(range);
    if (isFormulaError(numbers)) return numbers;
    const below = countBelow(numbers, n, false);
    if (numbers[below] !== n) return notFound('RANK');
    // Ties share the best rank.
    return ascending ? below + 1 : numbers.length - countBelow(numbers, n, true) + 1;
  },
};

export const lookup: FunctionTable = {
  SUMIF: conditional('SUMIF', 3, (s) => checkNumber(s.sum)),
  COUNTIF: conditional('COUNTIF', 2, (s) => s.matches, true),
  AVERAGEIF: conditional('AVERAGEIF', 3, (s) =>
    s.numbers ? checkNumber(s.sum / s.numbers) : DIV0,
  ),
  XLOOKUP: xlookup,
  MATCH: match,
  INDEX: index,
  RANK: rank,
};
