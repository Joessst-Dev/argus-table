import { describe, expect, it } from 'vitest';
import { DisplayRows } from './display-rows.js';

const positions = (rows: DisplayRows) => Array.from({ length: rows.count }, (_, i) => rows.at(i));

describe('DisplayRows', () => {
  it('is the identity without panels', () => {
    const rows = new DisplayRows(5);
    expect(rows.count).toBe(5);
    expect(rows.dataCount).toBe(5);
    expect(rows.at(3)).toEqual({ kind: 'data', index: 3 });
    expect(rows.at(5)).toBeUndefined();
    expect(rows.at(-1)).toBeUndefined();
    expect(rows.positionOf(3)).toBe(3);
    expect(rows.detailPositionOf(3)).toBeUndefined();
    expect(rows.hasDetail(3)).toBe(false);
  });

  it('puts a panel after each open row', () => {
    const rows = new DisplayRows(5, [3, 1]);
    expect(rows.count).toBe(7);
    expect(positions(rows)).toEqual([
      { kind: 'data', index: 0 },
      { kind: 'data', index: 1 },
      { kind: 'detail', index: 1 },
      { kind: 'data', index: 2 },
      { kind: 'data', index: 3 },
      { kind: 'detail', index: 3 },
      { kind: 'data', index: 4 },
    ]);
    expect(rows.positionOf(4)).toBe(6);
    expect(rows.detailPositionOf(1)).toBe(2);
    expect(rows.detailPositionOf(2)).toBeUndefined();
    expect(rows.hasDetail(3)).toBe(true);
  });

  it('ignores duplicates and indexes out of range', () => {
    const rows = new DisplayRows(3, [1, 1, 7, -1, 1.5]);
    expect(rows.open).toEqual([1]);
    expect(rows.count).toBe(4);
  });

  it('maps a range of positions to data rows', () => {
    const rows = new DisplayRows(5, [1]);
    expect(rows.dataRange(2, 3)).toEqual({ first: 2, last: 2 });
    expect(rows.dataRange(2, 2)).toBeUndefined();
    expect(rows.dataRange(0, 5)).toEqual({ first: 0, last: 4 });
    expect(rows.dataRange(1, 2)).toEqual({ first: 1, last: 1 });
  });

  it('round-trips every position', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const open = Array.from({ length: 50 }, () => Math.floor(random() * 1000));
    const rows = new DisplayRows(1000, open);
    expect(rows.count).toBe(1000 + new Set(open).size);
    for (let i = 0; i < 1000; i++) {
      expect(rows.at(rows.positionOf(i))).toEqual({ kind: 'data', index: i });
      const detail = rows.detailPositionOf(i);
      if (rows.hasDetail(i)) expect(rows.at(detail ?? -1)).toEqual({ kind: 'detail', index: i });
      else expect(detail).toBeUndefined();
    }
  });
});
