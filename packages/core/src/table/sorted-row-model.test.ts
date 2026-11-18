import { describe, expect, it } from 'vitest';
import { RADIX_MIN, sortRows, type SortColumn } from './sorted-row-model.js';

type Row = Record<string, unknown>;

const columnOf = (id: string): SortColumn<Row> => ({
  getValue: (row) => row[id],
  sortable: true,
});

/** The documented order for numbers: by value, `undefined` last either way, ties in data order. */
function expected(data: Row[], rows: number[], sorting: { id: string; desc: boolean }[]) {
  const key = (v: unknown) => (v instanceof Date ? v.getTime() : v);
  return [...rows].sort((i, j) => {
    for (const { id, desc } of sorting) {
      const a = key(data[i]?.[id]) as number | undefined;
      const b = key(data[j]?.[id]) as number | undefined;
      if (a === b) continue;
      if (a === undefined || b === undefined) return a === undefined ? 1 : -1;
      if (a !== b) return (a < b ? -1 : 1) * (desc ? -1 : 1);
    }
    return i - j;
  });
}

/** `n` rows of seeded values: few distinct ones, so ties are common, and every awkward number. */
function numbers(n: number): Row[] {
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const awkward = [
    0,
    -0,
    1,
    -1,
    0.5,
    -0.5,
    Infinity,
    -Infinity,
    Number.MAX_VALUE,
    -Number.MIN_VALUE,
    1e-310,
    undefined,
  ];
  return Array.from({ length: n }, (_, i) => ({
    // The first values pick the sort function: numbers.
    a: i < 10 ? i : awkward[Math.floor(next() * awkward.length)],
    b: Math.floor(next() * 3),
    when:
      i < 10 || next() > 0.1 ? new Date(Date.UTC(2026, 0, 1 + Math.floor(next() * 5))) : undefined,
  }));
}

describe('sortRows', () => {
  const data = numbers(RADIX_MIN * 2);
  const rows = data.map((_, i) => i);

  it.each([
    [[{ id: 'a', desc: false }]],
    [[{ id: 'a', desc: true }]],
    [
      [
        { id: 'b', desc: false },
        { id: 'a', desc: true },
      ],
    ],
    [
      [
        { id: 'when', desc: true },
        { id: 'b', desc: false },
        { id: 'a', desc: false },
      ],
    ],
  ])('sorts many rows of numbers and dates in the documented order: %j', (sorting) => {
    expect(sortRows(data, rows, sorting, columnOf)).toEqual(expected(data, rows, sorting));
  });

  it('sorts filtered rows, keeping their data order on ties', () => {
    const big = numbers(RADIX_MIN * 4);
    const odd = big.map((_, i) => i).filter((i) => i % 2 === 1);
    expect(sortRows(big, odd, [{ id: 'b', desc: true }], columnOf)).toEqual(
      expected(big, odd, [{ id: 'b', desc: true }]),
    );
  });

  it('falls back to the comparator for NaN and for rows out of data order', () => {
    const withNaN = data.map((row, i) => (i === 50 ? { ...row, a: NaN } : row));
    const sorted = sortRows(withNaN, rows, [{ id: 'a', desc: false }], columnOf);
    expect(sorted).toHaveLength(rows.length);
    expect(new Set(sorted).size).toBe(rows.length);
    const reversed = [...rows].reverse();
    // Ties in the order of `rows`' data indexes, not their places in `rows`.
    expect(sortRows(data, reversed, [{ id: 'b', desc: false }], columnOf)).toEqual(
      expected(data, rows, [{ id: 'b', desc: false }]),
    );
  });

  it('sorts text with the comparator, whatever the row count', () => {
    const words = rows.map((i) => ({ w: ['b', 'a', 'c'][i % 3] }));
    const sorted = sortRows(words, rows, [{ id: 'w', desc: false }], columnOf);
    expect(sorted.slice(0, 3)).toEqual([1, 4, 7]);
  });
});
