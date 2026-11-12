import { FormulaError, isFormulaError } from './errors.js';

/**
 * A whole column (`[[name]]`): its values in the rows the filters keep, in
 * `data` order. Only functions that take ranges accept one; anywhere else it is
 * `#VALUE!`. Made once per set of rows, so caches can hang off it.
 */
export class ColumnRange {
  constructor(readonly values: readonly unknown[]) {
    Object.freeze(this);
  }
}

export function isRange(value: unknown): value is ColumnRange {
  return value instanceof ColumnRange;
}

/** A range where one value belongs: in an operator, or a function that takes no ranges. */
export const RANGE_AS_VALUE = new FormulaError(
  '#VALUE!',
  'A whole column ([[name]]) is a list of values: use it in a function such as SUM, COUNTIF or XLOOKUP.',
);

/** Whole-column references without the rows they need (a `dataSource`). */
export const NO_RANGES = new FormulaError(
  '#N/A',
  'Whole-column references need data: the rows of a data source aren’t all loaded.',
);

/**
 * A value of a range as a number, the way aggregates count it: numbers and
 * numeric text; `undefined` for anything else (blanks, other text, booleans).
 * An error is returned as it is.
 */
export function numberIn(value: unknown): number | FormulaError | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (isFormulaError(value)) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    const n = text === '' ? NaN : Number(text);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
