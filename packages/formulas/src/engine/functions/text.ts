import { toDate, toNumber, toText } from '../coerce.js';
import { isFormulaError, VALUE, type FormulaError } from '../errors.js';
import { round } from './math.js';
import type { FunctionDef, FunctionTable } from './types.js';

/** A function of text and numbers: `kinds` says which argument is which (`t`, `n`). */
function textual(
  kinds: string,
  min: number,
  fn: (...args: (string | number)[]) => unknown,
  returns: FunctionDef['returns'] = 'text',
): FunctionDef {
  return {
    min,
    max: kinds.length,
    returns,
    fn: (...args) => {
      const values: (string | number)[] = [];
      for (const [i, arg] of args.entries()) {
        const value = kinds[i] === 'n' ? toNumber(arg) : toText(arg);
        if (isFormulaError(value)) return value;
        values.push(value);
      }
      return fn(...values);
    },
  };
}

/** Characters, not UTF-16 units, so an emoji counts once. */
const chars = (text: unknown) => Array.from(String(text));

const DATE_TOKEN = /yyyy|yy|mmmm|mmm|mm|m|dd|d|hh|h|ss|s|am\/pm/gi;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDatePattern(date: Date, pattern: string): string {
  const tokens = [...pattern.matchAll(DATE_TOKEN)].map((m) => m[0].toLowerCase());
  const twelveHour = tokens.includes('am/pm');
  let i = -1;
  return pattern.replace(DATE_TOKEN, (match) => {
    i++;
    const token = match.toLowerCase();
    // m / mm is minutes right after an hour or right before seconds.
    const minutes =
      (token === 'm' || token === 'mm') &&
      ((tokens[i - 1] ?? '').startsWith('h') || (tokens[i + 1] ?? '').startsWith('s'));
    const pad = (n: number) => String(n).padStart(token.length, '0');
    const hours = date.getHours();
    switch (token) {
      case 'yyyy':
        return String(date.getFullYear());
      case 'yy':
        return String(date.getFullYear() % 100).padStart(2, '0');
      case 'mmmm':
        return MONTHS[date.getMonth()] ?? '';
      case 'mmm':
        return (MONTHS[date.getMonth()] ?? '').slice(0, 3);
      case 'mm':
      case 'm':
        return pad(minutes ? date.getMinutes() : date.getMonth() + 1);
      case 'dd':
      case 'd':
        return pad(date.getDate());
      case 'hh':
      case 'h':
        return pad(twelveHour ? hours % 12 || 12 : hours);
      case 'ss':
      case 's':
        return pad(date.getSeconds());
      default:
        // am/pm
        return hours < 12 ? 'AM' : 'PM';
    }
  });
}

const NUMBER_PATTERN = /^([^#0,.]*)([#0,]*)(?:\.([#0]*))?(.*)$/;

/**
 * A number in a pattern such as `0.00`, `#,##0`, `0%` or `"€ "0.00`: `0` is a
 * digit always shown, `#` one shown only if needed, `,` groups thousands, `%`
 * multiplies by 100. Text around the digits is kept (quotes removed).
 */
function formatNumberPattern(n: number, pattern: string): string | FormulaError {
  const parts = NUMBER_PATTERN.exec(pattern);
  if (!parts) return VALUE;
  const [, prefix = '', whole = '', fraction = '', suffix = ''] = parts;
  if (!whole && !fraction) return VALUE;
  const literal = (text: string) => text.replace(/"([^"]*)"/g, '$1');
  const value = (prefix + suffix).includes('%') ? n * 100 : n;
  const minDecimals = fraction.replace(/#/g, '').length;
  let [int = '0', dec = ''] = Math.abs(round(value, fraction.length, 'nearest'))
    .toFixed(fraction.length)
    .split('.');
  // Optional (#) decimals drop their trailing zeros.
  while (dec.length > minDecimals && dec.endsWith('0')) dec = dec.slice(0, -1);
  const minInt = whole.replace(/[#,]/g, '').length;
  if (int === '0' && minInt === 0) int = '';
  int = int.padStart(minInt, '0');
  if (whole.includes(',')) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 && /[1-9]/.test(int + dec) ? '-' : '';
  return `${sign}${literal(prefix)}${int}${dec ? `.${dec}` : ''}${literal(suffix)}`;
}

export const text: FunctionTable = {
  CONCAT: {
    min: 1,
    max: Infinity,
    returns: 'text',
    fn: (...args) => {
      let result = '';
      for (const arg of args) {
        const t = toText(arg);
        if (isFormulaError(t)) return t;
        result += t;
      }
      return result;
    },
  },
  LEFT: textual('tn', 1, (t, n = 1) =>
    Number(n) < 0
      ? VALUE
      : chars(t)
          .slice(0, Math.trunc(Number(n)))
          .join(''),
  ),
  RIGHT: textual('tn', 1, (t, n = 1) => {
    const count = Math.trunc(Number(n));
    if (count < 0) return VALUE;
    return count === 0 ? '' : chars(t).slice(-count).join('');
  }),
  MID: textual('tnn', 3, (t, start, n) => {
    const from = Math.trunc(Number(start));
    const count = Math.trunc(Number(n));
    if (from < 1 || count < 0) return VALUE;
    return chars(t)
      .slice(from - 1, from - 1 + count)
      .join('');
  }),
  LEN: textual('t', 1, (t) => chars(t).length, 'number'),
  UPPER: textual('t', 1, (t) => String(t).toUpperCase()),
  LOWER: textual('t', 1, (t) => String(t).toLowerCase()),
  // Removes spaces at both ends and turns runs of spaces inside into one.
  TRIM: textual('t', 1, (t) => String(t).trim().replace(/\s+/g, ' ')),
  TEXT: {
    min: 2,
    max: 2,
    returns: 'text',
    fn: (value, pattern) => {
      const format = toText(pattern);
      if (isFormulaError(format)) return format;
      if (/[yd]|h|s|mmm/i.test(format.replace(/"[^"]*"/g, ''))) {
        const date = toDate(value);
        return isFormulaError(date) ? date : formatDatePattern(date, format);
      }
      const n = toNumber(value);
      return isFormulaError(n) ? n : formatNumberPattern(n, format);
    },
  },
};
