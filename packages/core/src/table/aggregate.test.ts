import { describe, expect, it, vi } from 'vitest';
import { aggregate } from './aggregate.js';

const noIds = () => [];

describe('aggregate', () => {
  it('sum adds numbers and numeric strings, skipping the rest', () => {
    expect(aggregate('sum', [1, '2', 'x', undefined, null], noIds)).toBe(3);
    expect(aggregate('sum', [], noIds)).toBe(0);
  });

  it('avg averages the numbers; nothing to average is undefined', () => {
    expect(aggregate('avg', [2, 4, 'x'], noIds)).toBe(3);
    expect(aggregate('avg', [], noIds)).toBeUndefined();
  });

  it('min and max take numbers or dates', () => {
    expect(aggregate('min', [3, '1', 2], noIds)).toBe(1);
    expect(aggregate('max', [3, '1', 2], noIds)).toBe(3);
    const early = new Date(2026, 0, 1);
    const late = new Date(2026, 5, 1);
    expect(aggregate('min', [late, early], noIds)).toBe(early);
    expect(aggregate('max', [late, undefined, early], noIds)).toBe(late);
    expect(aggregate('max', [], noIds)).toBeUndefined();
  });

  it('count counts values that aren’t empty', () => {
    expect(aggregate('count', [0, '', null, undefined, 'a', Number.NaN], noIds)).toBe(2);
  });

  it('a function gets the values, and the row ids only when it asks', () => {
    const ids = vi.fn(() => ['a', 'b']);
    expect(aggregate((values) => values.length, [1, 2], ids)).toBe(2);
    expect(ids).not.toHaveBeenCalled();
    expect(aggregate((_, { rowIds }) => rowIds.join(), [1, 2], ids)).toBe('a,b');
  });
});
