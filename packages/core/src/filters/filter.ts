import type { ColumnFilter, ColumnFilterState, FilterValue, RangeFilterOp } from '../types.js';

// Filtering rules, free of TanStack and the DOM: each filter compiles once into a
// test of one value, and the tests of a filter state combine into one test of a row.

/** A column as filtering sees it. */
export interface FilterColumn<TData> {
  id: string;
  getValue: (row: TData, index: number) => unknown;
  filterFn?: ((value: unknown, filter: ColumnFilter, row: TData) => boolean) | undefined;
}

/** Keeps a row (by its object and its index in `data`) or drops it. */
export type RowPredicate<TData> = (row: TData, index: number) => boolean;

/** `true` for `undefined`, `null`, `''`, `NaN` and an invalid `Date`. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'number') return Number.isNaN(value);
  return value instanceof Date && Number.isNaN(value.getTime());
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** A `Date` as its local day, `'2026-11-10'`. */
function isoDay(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A value as the text filters and the quick filter read it: strings as they are,
 * numbers and booleans as `String()` gives them, a `Date` as its local day
 * (`'2026-11-10'`), and anything else (empty values, objects) as `''`.
 */
export function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isNaN(value) ? '' : String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : isoDay(value);
  return '';
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A value's local day as a sortable number (`20261110`), or `undefined`. Takes a `Date`,
 * a timestamp, an ISO date (`'2026-11-10'`, read as that day, not as UTC midnight) or
 * any other string `Date` can parse.
 */
export function dayOf(value: unknown): number | undefined {
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number') date = new Date(value);
  else if (typeof value === 'string') {
    const day = DAY.exec(value.trim());
    if (day) return Number(day[1]) * 10000 + Number(day[2]) * 100 + Number(day[3]);
    if (!value.trim()) return undefined;
    date = new Date(value);
  } else return undefined;
  const time = date.getTime();
  if (Number.isNaN(time)) return undefined;
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** A value as a number for the number filters: numbers, and strings that are numbers. */
function numberOf(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * The value a `'set'` filter lists and compares: strings, numbers and booleans stay,
 * a `Date` becomes its local day, and empty values (and objects) become `null`.
 */
export function setValueOf(value: unknown): FilterValue {
  if (isEmptyValue(value)) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return value instanceof Date ? isoDay(value) : null;
}

function compare(
  op: RangeFilterOp,
  from: number | undefined,
  to: number | undefined,
): ((n: number | undefined) => boolean) | undefined {
  if (op === 'empty') return (n) => n === undefined;
  if (op === 'notEmpty') return (n) => n !== undefined;
  if (op === 'between') {
    if (from === undefined && to === undefined) return undefined;
    return (n) =>
      n !== undefined && (from === undefined || n >= from) && (to === undefined || n <= to);
  }
  if (from === undefined) return undefined;
  switch (op) {
    case 'eq':
      return (n) => n === from;
    case 'ne':
      // Like a spreadsheet: an empty cell isn't equal to the number, so it stays.
      return (n) => n !== from;
    case 'lt':
      return (n) => n !== undefined && n < from;
    case 'le':
      return (n) => n !== undefined && n <= from;
    case 'gt':
      return (n) => n !== undefined && n > from;
    case 'ge':
      return (n) => n !== undefined && n >= from;
  }
}

/**
 * A test of one value for a filter, or `undefined` when the filter keeps every row
 * (no text to match, no bound to compare with). Text matching ignores case.
 */
export function compileFilter(filter: ColumnFilter): ((value: unknown) => boolean) | undefined {
  switch (filter.kind) {
    case 'text': {
      if (filter.op === 'empty') return (v) => textOf(v) === '';
      if (filter.op === 'notEmpty') return (v) => textOf(v) !== '';
      const needle = (filter.value ?? '').toLowerCase();
      if (!needle) return undefined;
      if (filter.op === 'equals') return (v) => textOf(v).toLowerCase() === needle;
      if (filter.op === 'startsWith') return (v) => textOf(v).toLowerCase().startsWith(needle);
      return (v) => textOf(v).toLowerCase().includes(needle);
    }
    case 'number': {
      const test = compare(filter.op, numberOf(filter.value), numberOf(filter.to));
      return test && ((v) => test(numberOf(v)));
    }
    case 'date': {
      const test = compare(filter.op, dayOf(filter.value), dayOf(filter.to));
      return test && ((v) => test(dayOf(v)));
    }
    case 'set': {
      const values = new Set(filter.values);
      return (v) => values.has(setValueOf(v));
    }
  }
}

/** The words of a quick filter, lowercased; empty when it keeps every row. */
function quickTerms(quickFilter: string | undefined): string[] {
  return (quickFilter ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * One test of a row for the column filters and the quick filter, or `undefined` when
 * they keep every row. A row passes every column filter, and each word of the quick
 * filter is found in the text of one of `quickColumns` (ignoring case).
 *
 * Each value is read once per test through the column's `getValue`. A column with a
 * `filterFn` uses it in place of the built-in matching. Filters for unknown columns,
 * and on the `except` columns (for the values a column's own filter offers), are skipped.
 */
export function rowPredicate<TData>(
  columns: ReadonlyMap<string, FilterColumn<TData>>,
  filters: ColumnFilterState | undefined,
  quickFilter: string | undefined,
  quickColumns: readonly FilterColumn<TData>[],
  except?: ReadonlySet<string>,
): RowPredicate<TData> | undefined {
  const tests: RowPredicate<TData>[] = [];
  for (const [id, filter] of Object.entries(filters ?? {})) {
    const column = columns.get(id);
    if (!column || except?.has(id)) continue;
    const { getValue, filterFn } = column;
    if (filterFn) {
      tests.push((row, index) => filterFn(getValue(row, index), filter, row));
      continue;
    }
    const test = compileFilter(filter);
    if (test) tests.push((row, index) => test(getValue(row, index)));
  }
  const terms = quickTerms(quickFilter);
  if (terms.length && quickColumns.length) {
    const textAt = (c: FilterColumn<TData>, row: TData, index: number) =>
      textOf(c.getValue(row, index)).toLowerCase();
    const [term] = terms;
    tests.push(
      terms.length === 1 && term !== undefined
        ? (row, index) => quickColumns.some((c) => textAt(c, row, index).includes(term))
        : (row, index) => {
            const texts = quickColumns.map((c) => textAt(c, row, index));
            return terms.every((t) => texts.some((text) => text.includes(t)));
          },
    );
  }
  if (!tests.length) return undefined;
  if (tests.length === 1) return tests[0];
  return (row, index) => tests.every((test) => test(row, index));
}

const kindOrder = (v: FilterValue) =>
  v === null ? 3 : typeof v === 'boolean' ? 2 : typeof v === 'number' ? 0 : 1;

/** Orders set values: numbers, then text (by locale, numbers inside text by value), then booleans, then empty. */
export function compareSetValues(a: FilterValue, b: FilterValue): number {
  const kind = kindOrder(a) - kindOrder(b);
  if (kind) return kind;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }
  return Number(a) - Number(b);
}

/**
 * The distinct values of `column` over the rows `keep` passes, as a `'set'` filter
 * lists them (see `setValueOf`), sorted. Stops after `limit` values (`truncated`).
 */
export function distinctValues<TData>(
  rows: Iterable<{ original: TData; index: number }>,
  column: FilterColumn<TData>,
  keep: RowPredicate<TData> | undefined,
  limit: number,
): { values: FilterValue[]; truncated: boolean } {
  const seen = new Set<FilterValue>();
  let truncated = false;
  for (const { original, index } of rows) {
    if (keep && !keep(original, index)) continue;
    const value = setValueOf(column.getValue(original, index));
    if (seen.has(value)) continue;
    if (seen.size === limit) {
      truncated = true;
      break;
    }
    seen.add(value);
  }
  return { values: [...seen].sort(compareSetValues), truncated };
}
