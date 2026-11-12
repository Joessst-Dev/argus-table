import { checkNumber, isBlank, toNumber } from '../coerce.js';
import { DIV0, isFormulaError, NUM, type FormulaError } from '../errors.js';
import { isRange, numberIn } from '../range.js';
import type { FunctionDef, FunctionTable } from './types.js';

/** A function of numbers: each argument goes through `toNumber` first. */
function numeric(
  min: number,
  max: number,
  fn: (...n: number[]) => number | FormulaError,
): FunctionDef {
  return {
    min,
    max,
    returns: 'number',
    fn: (...args) => {
      const numbers: number[] = [];
      for (const arg of args) {
        const n = toNumber(arg);
        if (isFormulaError(n)) return n;
        numbers.push(n);
      }
      const result = fn(...numbers);
      return isFormulaError(result) ? result : checkNumber(result);
    },
  };
}

/**
 * The numbers of the arguments: a value counts unless it is blank (and must be
 * a number then); of a whole column only the numbers (and numeric text) count,
 * as spreadsheets skip text in ranges. The first error is returned instead.
 */
function numbersOf(args: readonly unknown[]): number[] | FormulaError {
  const numbers: number[] = [];
  for (const arg of args) {
    if (isRange(arg)) {
      for (const value of arg.values) {
        const n = numberIn(value);
        if (isFormulaError(n)) return n;
        if (n !== undefined) numbers.push(n);
      }
      continue;
    }
    if (isBlank(arg)) continue;
    const n = toNumber(arg);
    if (isFormulaError(n)) return n;
    numbers.push(n);
  }
  return numbers;
}

/**
 * `SUM`, `MIN`, `MAX`, `AVERAGE`: over their arguments and whole columns,
 * skipping blanks (an empty cell doesn't count, as in spreadsheets). `empty` is
 * the result with no value left.
 */
function aggregate(fn: (n: number[]) => number, empty: number | FormulaError): FunctionDef {
  return {
    min: 1,
    max: Infinity,
    returns: 'number',
    ranges: true,
    fn: (...args) => {
      const numbers = numbersOf(args);
      if (isFormulaError(numbers)) return numbers;
      return numbers.length ? checkNumber(fn(numbers)) : empty;
    },
  };
}

/** `COUNT`, `COUNTA`, `COUNTBLANK`: how many values (of the arguments and whole columns) `counts`. */
function count(counts: (value: unknown) => boolean): FunctionDef {
  return {
    min: 1,
    max: Infinity,
    returns: 'number',
    ranges: true,
    fn: (...args) => {
      let n = 0;
      for (const arg of args) {
        if (isRange(arg)) {
          for (const value of arg.values) if (counts(value)) n++;
        } else if (counts(arg)) n++;
      }
      return n;
    },
  };
}

const isNumber = (value: unknown): boolean => {
  const n = numberIn(value);
  return n !== undefined && !isFormulaError(n);
};

type Rounding = 'nearest' | 'up' | 'down';

/**
 * Rounds to `digits` decimals (negative: to tens, hundreds…). `nearest` takes
 * halves away from zero, `up` rounds away from zero, `down` toward it.
 * Float noise goes first, so 1.005 rounds to 1.01.
 */
export function round(n: number, digits: number, mode: Rounding): number {
  const factor = 10 ** Math.trunc(digits);
  const scaled = Number((Math.abs(n) * factor).toPrecision(15));
  const whole =
    mode === 'up' ? Math.ceil(scaled) : mode === 'down' ? Math.floor(scaled) : Math.round(scaled);
  const result = Number(((Math.sign(n) * whole) / factor).toPrecision(15));
  return result === 0 ? 0 : result;
}

export const math: FunctionTable = {
  SUM: aggregate((n) => n.reduce((a, b) => a + b, 0), 0),
  // A loop, not Math.min(...n): a spread of a million values overflows the stack.
  MIN: aggregate((n) => n.reduce((a, b) => (b < a ? b : a)), 0),
  MAX: aggregate((n) => n.reduce((a, b) => (b > a ? b : a)), 0),
  AVERAGE: aggregate((n) => n.reduce((a, b) => a + b, 0) / n.length, DIV0),
  COUNT: count(isNumber),
  COUNTA: count((value) => !isBlank(value)),
  COUNTBLANK: count(isBlank),
  ROUND: numeric(1, 2, (n, digits = 0) => round(n, digits, 'nearest')),
  ROUNDUP: numeric(1, 2, (n, digits = 0) => round(n, digits, 'up')),
  ROUNDDOWN: numeric(1, 2, (n, digits = 0) => round(n, digits, 'down')),
  ABS: numeric(1, 1, (n) => Math.abs(n)),
  INT: numeric(1, 1, (n) => Math.floor(n)),
  // The result takes the divisor's sign, as in spreadsheets: MOD(-3, 2) is 1.
  MOD: numeric(2, 2, (n, d) => (d === 0 ? DIV0 : n - d * Math.floor(n / d))),
  POWER: numeric(2, 2, (base, exponent) => (base === 0 && exponent <= 0 ? NUM : base ** exponent)),
  SQRT: numeric(1, 1, (n) => (n < 0 ? NUM : Math.sqrt(n))),
};
