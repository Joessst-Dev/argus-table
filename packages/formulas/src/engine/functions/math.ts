import { checkNumber, isBlank, toNumber } from '../coerce.js';
import { DIV0, isFormulaError, NUM, type FormulaError } from '../errors.js';
import type { FunctionDef, FunctionTable } from './types.js';

/** A function of numbers: each argument goes through `toNumber` first. */
export function numeric(
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
 * `SUM`, `MIN`, `MAX`, `AVERAGE`: over their arguments, skipping blanks (an
 * empty cell doesn't count, as in spreadsheets). `empty` is the result with no
 * value left.
 */
function aggregate(fn: (n: number[]) => number, empty: number | FormulaError): FunctionDef {
  return {
    min: 1,
    max: Infinity,
    returns: 'number',
    fn: (...args) => {
      const numbers: number[] = [];
      for (const arg of args) {
        if (isBlank(arg)) continue;
        const n = toNumber(arg);
        if (isFormulaError(n)) return n;
        numbers.push(n);
      }
      return numbers.length ? checkNumber(fn(numbers)) : empty;
    },
  };
}

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
  MIN: aggregate((n) => Math.min(...n), 0),
  MAX: aggregate((n) => Math.max(...n), 0),
  AVERAGE: aggregate((n) => n.reduce((a, b) => a + b, 0) / n.length, DIV0),
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
