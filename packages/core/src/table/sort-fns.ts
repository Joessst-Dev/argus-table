// The sort functions the model picks from, and the pick itself. Ported from
// TanStack Table v9.3.1 (`features/row-sorting/sortFns.ts` and
// `column_getAutoSortFn`, MIT License, Copyright (c) 2016 Tanner Linsley) so that
// sort orders stay what they were before core had its own row model (ADR 0010).

/** A sort function: a normalizer applied once per value, and a comparator of normalized values. */
export interface SortFn {
  resolve?: (value: unknown) => unknown;
  compare: (a: unknown, b: unknown) => number;
}

function compareBasic(a: unknown, b: unknown): number {
  // Values of one column: compared as JavaScript compares them.
  return a === b ? 0 : (a as number) > (b as number) ? 1 : -1;
}

function toText(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isNaN(value) || value === Infinity || value === -Infinity ? '' : String(value);
  }
  return typeof value === 'string' ? value : '';
}

const isDigit = (code: number) => code >= 48 && code <= 57;

function chunkEnd(text: string, start: number, numeric: boolean): number {
  let end = start + 1;
  while (end < text.length && isDigit(text.charCodeAt(end)) === numeric) end++;
  return end;
}

function compareTextChunks(
  a: string,
  aStart: number,
  aEnd: number,
  b: string,
  bStart: number,
  bEnd: number,
): number {
  const aLength = aEnd - aStart;
  const bLength = bEnd - bStart;
  const length = Math.min(aLength, bLength);
  for (let i = 0; i < length; i++) {
    const diff = a.charCodeAt(aStart + i) - b.charCodeAt(bStart + i);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return aLength === bLength ? 0 : aLength > bLength ? 1 : -1;
}

function smallInt(text: string, start: number, end: number): number {
  let n = 0;
  for (let i = start; i < end; i++) n = n * 10 + text.charCodeAt(i) - 48;
  return n;
}

function compareNumberChunks(
  a: string,
  aStart: number,
  aEnd: number,
  b: string,
  bStart: number,
  bEnd: number,
): number {
  let aFrom = aStart;
  while (aFrom < aEnd && a.charCodeAt(aFrom) === 48) aFrom++;
  let bFrom = bStart;
  while (bFrom < bEnd && b.charCodeAt(bFrom) === 48) bFrom++;
  if (aFrom === aEnd && bFrom === bEnd) return 0;
  const small = aEnd - aFrom <= 15 && bEnd - bFrom <= 15;
  const an = small ? smallInt(a, aFrom, aEnd) : parseInt(a.slice(aStart, aEnd), 10);
  const bn = small ? smallInt(b, bFrom, bEnd) : parseInt(b.slice(bStart, bEnd), 10);
  return an > bn ? 1 : bn > an ? -1 : 0;
}

function chunkCount(text: string, start: number): number {
  let count = 0;
  for (let i = start; i < text.length; count++) i = chunkEnd(text, i, isDigit(text.charCodeAt(i)));
  return count;
}

/** Natural order: runs of digits compare as numbers (`item2` before `item10`). */
function compareAlphanumeric(a: string, b: string): number {
  let ai = 0;
  let bi = 0;
  while (ai < a.length && bi < b.length) {
    const aNumber = isDigit(a.charCodeAt(ai));
    const bNumber = isDigit(b.charCodeAt(bi));
    const aEnd = chunkEnd(a, ai, aNumber);
    const bEnd = chunkEnd(b, bi, bNumber);
    if (aNumber !== bNumber) return aNumber ? 1 : -1;
    const result = aNumber
      ? compareNumberChunks(a, ai, aEnd, b, bi, bEnd)
      : compareTextChunks(a, ai, aEnd, b, bi, bEnd);
    if (result) return result;
    ai = aEnd;
    bi = bEnd;
  }
  return chunkCount(a, ai) - chunkCount(b, bi);
}

const lowerText = (value: unknown) => toText(value).toLowerCase();

export const sortAlphanumeric: SortFn = {
  resolve: lowerText,
  compare: (a, b) => compareAlphanumeric(a as string, b as string),
};

export const sortText: SortFn = { resolve: lowerText, compare: compareBasic };

export const sortDatetime: SortFn = {
  resolve: (value) => (value instanceof Date ? value.getTime() : value),
  compare: (a, b) => ((a as number) > (b as number) ? 1 : (a as number) < (b as number) ? -1 : 0),
};

export const sortBasic: SortFn = { compare: compareBasic };

/**
 * Picks a sort function from a column's first values (at most 10): `datetime` for
 * a `Date`, `alphanumeric` for text with digits in it, `text` for other text, else
 * `basic`.
 */
export function autoSortFn(values: Iterable<unknown>): SortFn {
  let text = false;
  for (const value of values) {
    if (Object.prototype.toString.call(value) === '[object Date]') return sortDatetime;
    if (typeof value === 'string') {
      text = true;
      if (/[0-9]/.test(value)) return sortAlphanumeric;
    }
  }
  return text ? sortText : sortBasic;
}
