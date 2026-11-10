import { toDate, toText } from '../coerce.js';
import { isFormulaError, NUM, type FormulaError } from '../errors.js';
import type { FunctionDef, FunctionTable } from './types.js';

/** A function of dates: each argument goes through `toDate` first. */
function dated(count: number, fn: (...dates: Date[]) => number | FormulaError): FunctionDef {
  return {
    min: count,
    max: count,
    returns: 'number',
    fn: (...args) => {
      const dates: Date[] = [];
      for (const arg of args) {
        const date = toDate(arg);
        if (isFormulaError(date)) return date;
        dates.push(date);
      }
      return fn(...dates);
    },
  };
}

const DAY = 86_400_000;

/** Days since 1970 of the calendar date (time and daylight saving ignored). */
const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** Whole months from `start` to `end`. */
function months(start: Date, end: Date): number {
  const total =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return end.getDate() < start.getDate() ? total - 1 : total;
}

function datedif(start: Date, end: Date, unit: string): number | FormulaError {
  if (dayNumber(start) > dayNumber(end)) return NUM;
  switch (unit.toUpperCase()) {
    case 'Y':
      return Math.floor(months(start, end) / 12);
    case 'M':
      return months(start, end);
    case 'D':
      return dayNumber(end) - dayNumber(start);
    case 'YM':
      return months(start, end) % 12;
    case 'MD': {
      if (end.getDate() >= start.getDate()) return end.getDate() - start.getDate();
      // Days left in the month before `end`'s month, plus `end`'s day.
      const year = end.getMonth() === 0 ? end.getFullYear() - 1 : end.getFullYear();
      const month = (end.getMonth() + 11) % 12;
      return Math.max(0, daysInMonth(year, month) - start.getDate()) + end.getDate();
    }
    case 'YD': {
      // `start` moved into the last year that keeps it on or before `end`.
      let year = end.getFullYear();
      const day = (y: number) =>
        dayNumber(
          new Date(
            y,
            start.getMonth(),
            Math.min(start.getDate(), daysInMonth(y, start.getMonth())),
          ),
        );
      if (day(year) > dayNumber(end)) year--;
      return dayNumber(end) - day(year);
    }
    default:
      return NUM;
  }
}

export const date: FunctionTable = {
  TODAY: {
    min: 0,
    max: 0,
    returns: 'date',
    fn: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
  },
  YEAR: dated(1, (d) => d.getFullYear()),
  MONTH: dated(1, (d) => d.getMonth() + 1),
  DAY: dated(1, (d) => d.getDate()),
  // DAYS(end, start), as in spreadsheets: the later date comes first.
  DAYS: dated(2, (end, start) => dayNumber(end) - dayNumber(start)),
  DATEDIF: {
    min: 3,
    max: 3,
    returns: 'number',
    fn: (start, end, unit) => {
      const from = toDate(start);
      if (isFormulaError(from)) return from;
      const to = toDate(end);
      if (isFormulaError(to)) return to;
      const u = toText(unit);
      if (isFormulaError(u)) return u;
      return datedif(from, to, u);
    },
  },
};
