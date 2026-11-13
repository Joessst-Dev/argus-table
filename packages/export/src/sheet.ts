import type { ColumnAlign, ColumnPin } from 'argus-table';

/** A cell's value as the writers take it: what a column read, made plain. */
export type ExportValue = string | number | boolean | Date | null;

/** A column of an export. */
export interface ExportColumn {
  id: string;
  /** The header text. */
  header: string;
  align: ColumnAlign;
  /** The column's width in the table, in px. */
  width: number;
  pin: ColumnPin | undefined;
}

/** A cell of a group header row: a group's header, or `''` over columns without one. */
export interface ExportHeaderCell {
  text: string;
  /** Number of columns under it. */
  span: number;
}

/** What an export holds, whatever the format: the writers are functions of it. */
export interface ExportSheet {
  columns: ExportColumn[];
  /** The group header rows over the column headers, top row first; each row's spans add up to the columns. */
  groups: ExportHeaderCell[][];
  /** The rows, each with one value per column. */
  rows: ExportValue[][];
}

/**
 * Makes what a column read plain: numbers (not `NaN` or infinite), strings,
 * booleans and valid dates stay; `null` and `undefined` become `null`; other
 * objects become JSON, as the table shows them without a `cell`.
 */
export function toValue(value: unknown): ExportValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      // A cycle.
      return Object.prototype.toString.call(value);
    }
  }
  // Symbols and functions have no value to write.
  return typeof value === 'bigint' ? value.toString() : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Whether a date is at midnight, local time: a date without a time of day. */
export const isDay = (date: Date) =>
  date.getHours() === 0 &&
  date.getMinutes() === 0 &&
  date.getSeconds() === 0 &&
  date.getMilliseconds() === 0;

/**
 * A value as portable text: numbers as JavaScript writes them, dates as local
 * `YYYY-MM-DD`, with ` HH:MM` (and `:SS`) when they have a time of day.
 */
export function plainText(value: ExportValue): string {
  if (value === null) return '';
  if (!(value instanceof Date)) return String(value);
  const day = `${String(value.getFullYear())}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  if (isDay(value)) return day;
  const seconds = value.getSeconds() ? `:${pad(value.getSeconds())}` : '';
  return `${day} ${pad(value.getHours())}:${pad(value.getMinutes())}${seconds}`;
}
