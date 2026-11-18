import { plainText, type ExportSheet, type ExportValue } from './sheet.js';

/** Options for CSV. */
export interface CsvOptions {
  /** Between fields. Default `,`. */
  delimiter?: string;
  /** Starts the file with a byte order mark, so Excel reads it as UTF-8. Default `true`. */
  bom?: boolean;
  /**
   * Puts `'` before text that starts with `=`, `+`, `-`, `@`, a tab or a carriage
   * return, so a spreadsheet opening the file doesn't run it as a formula (CSV
   * injection). Numbers are never changed. Default `true`.
   */
  escapeFormulas?: boolean;
}

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * The sheet as CSV (RFC 4180): the group header rows (a group's text in its
 * first column), the column headers, then the rows; CRLF line ends. Detail rows
 * flatten: their columns follow the table's, and a row is written once per detail
 * row (once, with the detail columns empty, when it has none).
 */
export function toCsv(sheet: ExportSheet, options: CsvOptions = {}): string {
  const { delimiter = ',', bom = true, escapeFormulas = true } = options;
  const field = (value: ExportValue) => {
    const text =
      typeof value === 'string' && escapeFormulas && FORMULA_START.test(value)
        ? `'${value}`
        : plainText(value);
    return /["\r\n]/.test(text) || text.includes(delimiter)
      ? `"${text.replaceAll('"', '""')}"`
      : text;
  };
  const detail = sheet.detail;
  // With detail rows: their columns after the table's, each row repeated per detail row.
  const empty: ExportValue[] = detail ? detail.columns.map(() => null) : [];
  const body = detail
    ? sheet.rows.flatMap((row, i) => {
        const lines = detail.rows[i];
        return lines?.length ? lines.map((line) => [...row, ...line]) : [[...row, ...empty]];
      })
    : sheet.rows;
  const lines = [
    ...sheet.groups.map((row) => [
      ...row.flatMap((cell) => [cell.text, ...Array.from({ length: cell.span - 1 }, () => '')]),
      ...empty,
    ]),
    [...sheet.columns, ...(detail?.columns ?? [])].map((c) => c.header),
    ...body,
  ].map((row) => row.map(field).join(delimiter));
  return `${bom ? '﻿' : ''}${lines.join('\r\n')}\r\n`;
}
