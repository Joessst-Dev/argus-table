import { describe, expect, it } from 'vitest';
import type { ColumnFilter, ColumnFilterState } from '../types.js';
import {
  compareSetValues,
  compileFilter,
  dayOf,
  distinctValues,
  isEmptyValue,
  rowPredicate,
  setValueOf,
  textOf,
  type FilterColumn,
} from './filter.js';

const keeps = (filter: ColumnFilter, values: unknown[]) => {
  const test = compileFilter(filter);
  return test ? values.filter((v) => test(v)) : 'all';
};

describe('values', () => {
  it('treats undefined, null, empty text, NaN and invalid dates as empty', () => {
    for (const v of [undefined, null, '', Number.NaN, new Date('nope')]) {
      expect(isEmptyValue(v)).toBe(true);
    }
    for (const v of [0, ' ', false, new Date(2026, 0, 1), 'a']) expect(isEmptyValue(v)).toBe(false);
  });

  it('reads text from strings, numbers, booleans and dates only', () => {
    expect(textOf('Ab')).toBe('Ab');
    expect(textOf(12.5)).toBe('12.5');
    expect(textOf(true)).toBe('true');
    expect(textOf(new Date(2026, 10, 9, 23, 30))).toBe('2026-11-09');
    expect(textOf({ a: 1 })).toBe('');
    expect(textOf(Number.NaN)).toBe('');
    expect(textOf(undefined)).toBe('');
  });

  it('reads an ISO date as that local day, and dates and timestamps by local day', () => {
    expect(dayOf('2026-11-10')).toBe(20261110);
    expect(dayOf(new Date(2026, 10, 10, 23, 59))).toBe(20261110);
    expect(dayOf(new Date(2026, 0, 2).getTime())).toBe(20260102);
    expect(dayOf('2026-11-10T08:00')).toBe(20261110);
    expect(dayOf('')).toBeUndefined();
    expect(dayOf('soon')).toBeUndefined();
    expect(dayOf(null)).toBeUndefined();
  });

  it('turns values into set values', () => {
    expect(setValueOf('')).toBeNull();
    expect(setValueOf(undefined)).toBeNull();
    expect(setValueOf(3)).toBe(3);
    expect(setValueOf(false)).toBe(false);
    expect(setValueOf(new Date(2026, 10, 10))).toBe('2026-11-10');
  });

  it('orders set values: numbers, text, booleans, empty', () => {
    const values = ['b', null, 10, true, 'a10', 2, 'a9', false];
    expect(values.sort(compareSetValues)).toEqual([2, 10, 'a9', 'a10', 'b', false, true, null]);
  });
});

describe('compileFilter: text', () => {
  const values = ['Berlin', 'bern', 'Bonn', '', undefined, 42, 'Wolfsburg'];

  it('finds text anywhere, ignoring case', () => {
    expect(keeps({ kind: 'text', op: 'contains', value: 'ER' }, values)).toEqual([
      'Berlin',
      'bern',
    ]);
    expect(keeps({ kind: 'text', op: 'contains', value: '4' }, values)).toEqual([42]);
  });

  it('matches whole text and starts', () => {
    expect(keeps({ kind: 'text', op: 'equals', value: 'BERN' }, values)).toEqual(['bern']);
    expect(keeps({ kind: 'text', op: 'startsWith', value: 'b' }, values)).toEqual([
      'Berlin',
      'bern',
      'Bonn',
    ]);
  });

  it('keeps every row without text to match', () => {
    expect(keeps({ kind: 'text', op: 'contains', value: '' }, values)).toBe('all');
    expect(keeps({ kind: 'text', op: 'equals' }, values)).toBe('all');
  });

  it('finds empty and non-empty values', () => {
    expect(keeps({ kind: 'text', op: 'empty' }, values)).toEqual(['', undefined]);
    expect(keeps({ kind: 'text', op: 'notEmpty' }, values)).toHaveLength(5);
  });
});

describe('compileFilter: number', () => {
  const values = [1, 5, 10, '7', undefined, null, Number.NaN, 'x'];

  it('compares', () => {
    expect(keeps({ kind: 'number', op: 'eq', value: 5 }, values)).toEqual([5]);
    expect(keeps({ kind: 'number', op: 'gt', value: 5 }, values)).toEqual([10, '7']);
    expect(keeps({ kind: 'number', op: 'ge', value: 5 }, values)).toEqual([5, 10, '7']);
    expect(keeps({ kind: 'number', op: 'lt', value: 5 }, values)).toEqual([1]);
    expect(keeps({ kind: 'number', op: 'le', value: 5 }, values)).toEqual([1, 5]);
  });

  it('keeps empty values for "not equal"', () => {
    expect(keeps({ kind: 'number', op: 'ne', value: 5 }, values)).toEqual([
      1,
      10,
      '7',
      undefined,
      null,
      Number.NaN,
      'x',
    ]);
  });

  it('takes inclusive ranges, open at a missing end', () => {
    expect(keeps({ kind: 'number', op: 'between', value: 5, to: 7 }, values)).toEqual([5, '7']);
    expect(keeps({ kind: 'number', op: 'between', to: 5 }, values)).toEqual([1, 5]);
    expect(keeps({ kind: 'number', op: 'between' }, values)).toBe('all');
  });

  it('keeps every row without a bound, and finds empty values', () => {
    expect(keeps({ kind: 'number', op: 'gt' }, values)).toBe('all');
    expect(keeps({ kind: 'number', op: 'empty' }, values)).toEqual([
      undefined,
      null,
      Number.NaN,
      'x',
    ]);
    expect(keeps({ kind: 'number', op: 'notEmpty' }, values)).toEqual([1, 5, 10, '7']);
  });
});

describe('compileFilter: date', () => {
  const values = [
    new Date(2026, 10, 9, 22),
    '2026-11-10',
    new Date(2026, 10, 11).getTime(),
    undefined,
    'later',
  ];

  it('compares by local day', () => {
    expect(keeps({ kind: 'date', op: 'eq', value: '2026-11-09' }, values)).toEqual([values[0]]);
    expect(keeps({ kind: 'date', op: 'ge', value: '2026-11-10' }, values)).toEqual([
      values[1],
      values[2],
    ]);
    expect(
      keeps({ kind: 'date', op: 'between', value: '2026-11-09', to: '2026-11-10' }, values),
    ).toEqual([values[0], values[1]]);
    expect(keeps({ kind: 'date', op: 'empty' }, values)).toEqual([undefined, 'later']);
  });
});

describe('compileFilter: set', () => {
  it('keeps listed values, null for empty ones', () => {
    const values = ['a', 'b', '', undefined, 1, '1', new Date(2026, 10, 10)];
    expect(keeps({ kind: 'set', values: ['a', null, 1, '2026-11-10'] }, values)).toEqual([
      'a',
      '',
      undefined,
      1,
      values[6],
    ]);
    expect(keeps({ kind: 'set', values: [] }, values)).toEqual([]);
  });
});

interface Row {
  name: string;
  city: string;
  age: number;
}

const rows: Row[] = [
  { name: 'Ada', city: 'Berlin', age: 36 },
  { name: 'Ben', city: 'Bonn', age: 41 },
  { name: 'Cleo', city: 'Berlin', age: 22 },
  { name: 'Dan', city: 'Celle', age: 41 },
];
const column = (id: keyof Row, extra: Partial<FilterColumn<Row>> = {}): FilterColumn<Row> => ({
  id,
  getValue: (row) => row[id],
  ...extra,
});
const byId = new Map([column('name'), column('city'), column('age')].map((c) => [c.id, c]));
const all = [...byId.values()];
const get = (id: string) => {
  const found = byId.get(id);
  if (!found) throw new Error(id);
  return found;
};
const pass = (test: ((row: Row, index: number) => boolean) | undefined) =>
  test ? rows.filter((row, i) => test(row, i)).map((r) => r.name) : 'all';

describe('rowPredicate', () => {
  it('keeps every row with nothing to filter by', () => {
    expect(rowPredicate(byId, {}, '', all)).toBeUndefined();
    expect(rowPredicate(byId, undefined, '  ', all)).toBeUndefined();
    expect(rowPredicate(byId, { name: { kind: 'text', op: 'contains' } }, '', all)).toBeUndefined();
  });

  it('combines column filters with AND and ignores unknown columns', () => {
    const test = rowPredicate(
      byId,
      {
        city: { kind: 'text', op: 'equals', value: 'berlin' },
        age: { kind: 'number', op: 'gt', value: 30 },
        nope: { kind: 'text', op: 'contains', value: 'x' },
      },
      '',
      all,
    );
    expect(pass(test)).toEqual(['Ada']);
  });

  it('finds each quick filter word in some column', () => {
    expect(pass(rowPredicate(byId, {}, 'berlin', all))).toEqual(['Ada', 'Cleo']);
    expect(pass(rowPredicate(byId, {}, 'BERLIN  cl', all))).toEqual(['Cleo']);
    expect(pass(rowPredicate(byId, {}, '41', all))).toEqual(['Ben', 'Dan']);
    // Only the given columns count.
    expect(pass(rowPredicate(byId, {}, 'berlin', [get('name')]))).toEqual([]);
  });

  it('uses a column filterFn in place of the built-in matching', () => {
    const custom = new Map(byId);
    custom.set(
      'age',
      column('age', {
        filterFn: (value, filter, row) =>
          filter.kind === 'number' && row.name !== 'Ben' && (value as number) > 40,
      }),
    );
    const test = rowPredicate(custom, { age: { kind: 'number', op: 'between' } }, '', all);
    expect(pass(test)).toEqual(['Dan']);
  });

  it('skips the excepted column', () => {
    const filters: ColumnFilterState = {
      city: { kind: 'set', values: ['Berlin'] },
      age: { kind: 'number', op: 'ge', value: 30 },
    };
    expect(pass(rowPredicate(byId, filters, '', all, 'city'))).toEqual(['Ada', 'Ben', 'Dan']);
  });
});

describe('distinctValues', () => {
  const asRows = rows.map((original, index) => ({ original, index }));

  it('lists sorted distinct values of the rows kept', () => {
    expect(distinctValues(asRows, get('city'), undefined, 10)).toEqual({
      values: ['Berlin', 'Bonn', 'Celle'],
      truncated: false,
    });
    const older = rowPredicate(byId, { age: { kind: 'number', op: 'gt', value: 40 } }, '', all);
    expect(distinctValues(asRows, get('city'), older, 10).values).toEqual(['Bonn', 'Celle']);
  });

  it('stops at the limit', () => {
    expect(distinctValues(asRows, get('name'), undefined, 2)).toEqual({
      values: ['Ada', 'Ben'],
      truncated: true,
    });
  });
});
