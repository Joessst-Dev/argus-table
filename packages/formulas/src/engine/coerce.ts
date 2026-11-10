import { FormulaError, isFormulaError, NUM, VALUE } from './errors.js';

/** `null`, `undefined` and empty text: an empty cell. */
export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** A number as a spreadsheet keeps it: non-finite results are `#NUM!`, -0 is 0. */
export function checkNumber(n: number): number | FormulaError {
  if (!Number.isFinite(n)) return NUM;
  return n === 0 ? 0 : n;
}

/**
 * A value as a number: blank is 0, `TRUE` 1, numeric text its number. Other
 * text, dates and objects are `#VALUE!`; errors pass through.
 */
export function toNumber(value: unknown): number | FormulaError {
  if (isFormulaError(value)) return value;
  if (isBlank(value)) return 0;
  if (typeof value === 'number') return checkNumber(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const text = value.trim();
    const n = text === '' ? NaN : Number(text);
    return Number.isFinite(n) ? n : VALUE;
  }
  return VALUE;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** `2024-03-09`, with ` 14:05:00` after it unless the time is midnight. */
export function formatDate(date: Date): string {
  const day = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  return h || m || s ? `${day} ${pad(h)}:${pad(m)}:${pad(s)}` : day;
}

/** A number with at most 15 significant digits, as spreadsheets show it (`0.1 + 0.2` is `0.3`). */
export function formatNumber(n: number): string {
  return String(Number(n.toPrecision(15)));
}

/**
 * A value as text: blank is `""`, numbers as `formatNumber` writes them,
 * booleans `TRUE` / `FALSE`, dates as `formatDate` writes them. Errors pass through.
 */
export function toText(value: unknown): string | FormulaError {
  if (isFormulaError(value)) return value;
  if (isBlank(value)) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (isDate(value)) return formatDate(value);
  return VALUE;
}

/** A value as a boolean: blank is `FALSE`, numbers are `TRUE` unless 0, text must read `TRUE` or `FALSE`. */
export function toBoolean(value: unknown): boolean | FormulaError {
  if (isFormulaError(value)) return value;
  if (isBlank(value)) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
  }
  return VALUE;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A value as a date: a `Date`, or ISO text. `2024-03-09` is local midnight
 * (not UTC, as `new Date()` would read it). Anything else is `#VALUE!`.
 */
export function toDate(value: unknown): Date | FormulaError {
  if (isFormulaError(value)) return value;
  if (isDate(value)) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    const parts = DATE_ONLY.exec(text);
    if (parts) {
      const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
      return date.getDate() === Number(parts[3]) ? date : VALUE;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      const date = new Date(text);
      if (isDate(date)) return date;
    }
  }
  return VALUE;
}

/** Spreadsheet order between types: numbers (and dates), then text, then booleans. */
function rank(value: unknown): number {
  if (typeof value === 'string') return 1;
  if (typeof value === 'boolean') return 2;
  return 0;
}

/**
 * Compares two values for `=`, `<` and the rest: numbers by size, text without
 * case, `FALSE` before `TRUE`, dates by time. A blank counts as `0`, `""` or
 * `FALSE`, whichever the other side is. Values of different types order as
 * numbers < text < booleans. Errors pass through.
 */
export function compare(a: unknown, b: unknown): number | FormulaError {
  if (isFormulaError(a)) return a;
  if (isFormulaError(b)) return b;
  if (isBlank(a) && isBlank(b)) return 0;
  const normal = (value: unknown, other: unknown): unknown => {
    if (isDate(value)) return value.getTime();
    if (!isBlank(value)) return value;
    if (typeof other === 'string') return '';
    if (typeof other === 'boolean') return false;
    return 0;
  };
  const x = normal(a, b);
  const y = normal(b, a);
  if (typeof x === 'object' || typeof y === 'object') return VALUE;
  const rx = rank(x);
  const ry = rank(y);
  if (rx !== ry) return rx - ry;
  if (typeof x === 'string' && typeof y === 'string') {
    const lx = x.toLowerCase();
    const ly = y.toLowerCase();
    return lx < ly ? -1 : lx > ly ? 1 : 0;
  }
  const nx = Number(x);
  const ny = Number(y);
  return nx < ny ? -1 : nx > ny ? 1 : 0;
}
