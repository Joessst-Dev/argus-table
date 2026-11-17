import { describe, expect, it } from 'vitest';
import {
  autoSortFn,
  sortAlphanumeric,
  sortBasic,
  sortDatetime,
  sortText,
  type SortFn,
} from './sort-fns.js';

const sorted = (fn: SortFn, values: unknown[]) => {
  const resolve = fn.resolve ?? ((v: unknown) => v);
  return [...values].sort((a, b) => fn.compare(resolve(a), resolve(b)));
};

describe('sort functions', () => {
  it('sorts text with digits naturally, ignoring case', () => {
    expect(sorted(sortAlphanumeric, ['item10', 'Item2', 'item1', 'item'])).toEqual([
      'item',
      'item1',
      'Item2',
      'item10',
    ]);
  });

  it('compares digit runs by value, leading zeros and long runs included', () => {
    expect(sorted(sortAlphanumeric, ['n010', 'n9', 'n0001'])).toEqual(['n0001', 'n9', 'n010']);
    expect(sorted(sortAlphanumeric, ['n1234567890123456789', 'n999999999999999999', 'n2'])).toEqual(
      ['n2', 'n999999999999999999', 'n1234567890123456789'],
    );
  });

  it('puts text before digits at the same place, and fewer chunks first', () => {
    expect(sorted(sortAlphanumeric, ['1', 'a'])).toEqual(['a', '1']);
    expect(sorted(sortAlphanumeric, ['a1', 'aa', 'a', 'a1b'])).toEqual(['a', 'a1', 'a1b', 'aa']);
  });

  it('treats values other than text and finite numbers as empty text', () => {
    expect(sortAlphanumeric.resolve?.(NaN)).toBe('');
    expect(sortAlphanumeric.resolve?.(Infinity)).toBe('');
    expect(sortAlphanumeric.resolve?.(null)).toBe('');
    expect(sortText.resolve?.(12)).toBe('12');
  });

  it('sorts text by code unit after lowercasing', () => {
    expect(sorted(sortText, ['b', 'B', 'a', 'Ä'])).toEqual(['a', 'b', 'B', 'Ä']);
  });

  it('sorts dates by time and other values as they compare', () => {
    const early = new Date(2020, 0, 1);
    const late = new Date(2021, 0, 1);
    expect(sorted(sortDatetime, [late, early])).toEqual([early, late]);
    expect(sorted(sortBasic, [3, 1, 2])).toEqual([1, 2, 3]);
  });
});

describe('autoSortFn', () => {
  it('picks by the first values', () => {
    expect(autoSortFn([1, 2])).toBe(sortBasic);
    expect(autoSortFn(['a', 'b'])).toBe(sortText);
    expect(autoSortFn(['a', 'b2'])).toBe(sortAlphanumeric);
    expect(autoSortFn([undefined, new Date()])).toBe(sortDatetime);
    expect(autoSortFn([])).toBe(sortBasic);
  });

  it('stops at the first date or text with digits', () => {
    expect(autoSortFn(['a1', new Date()])).toBe(sortAlphanumeric);
    expect(autoSortFn([new Date(), 'a1'])).toBe(sortDatetime);
  });
});
