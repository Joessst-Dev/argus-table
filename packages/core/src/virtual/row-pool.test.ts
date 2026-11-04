import { describe, expect, it } from 'vitest';
import { RowPool } from './row-pool.js';

const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => `r${String(from + i)}`);

describe('RowPool', () => {
  it('assigns one slot per rendered row', () => {
    const pool = new RowPool();
    const entries = pool.update(range(0, 4));
    expect(entries).toEqual([
      { id: 'r0', slot: 0 },
      { id: 'r1', slot: 1 },
      { id: 'r2', slot: 2 },
      { id: 'r3', slot: 3 },
    ]);
    expect(pool.size).toBe(4);
  });

  it('keeps slots for rows that stay rendered', () => {
    const pool = new RowPool();
    pool.update(range(0, 4));
    pool.update(range(1, 5));
    expect(range(1, 4).map((id) => pool.slotOf(id))).toEqual([1, 2, 3]);
  });

  it('reuses freed slots instead of creating new ones', () => {
    const pool = new RowPool();
    pool.update(range(0, 4));
    const entries = pool.update(range(1, 5));
    expect(pool.slotOf('r0')).toBeUndefined();
    expect(pool.slotOf('r4')).toBe(0);
    expect(pool.size).toBe(4);
    // Pool order: by slot, not by row index.
    expect(entries.map((e) => e.id)).toEqual(['r4', 'r1', 'r2', 'r3']);
  });

  it('stays bounded across a jump far down the list', () => {
    const pool = new RowPool();
    pool.update(range(0, 30));
    const entries = pool.update(range(50_000, 50_030));
    expect(pool.size).toBe(30);
    expect(entries.map((e) => e.slot).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, i) => i),
    );
  });

  it('keeps the pinned row rendered and in its slot while out of range', () => {
    const pool = new RowPool();
    pool.update(range(0, 4));
    pool.pin('r1');
    const entries = pool.update(range(10, 14));
    expect(pool.slotOf('r1')).toBe(1);
    expect(entries.map((e) => e.id)).toContain('r1');
    expect(entries).toHaveLength(5);
    expect(pool.size).toBe(5);
  });

  it('frees the pinned slot once released', () => {
    const pool = new RowPool();
    pool.update(range(0, 4));
    pool.pin('r1');
    pool.update(range(10, 14));
    pool.pin(undefined);
    pool.update(range(10, 14));
    expect(pool.slotOf('r1')).toBeUndefined();
  });

  it('ignores duplicate ids', () => {
    const pool = new RowPool();
    expect(pool.update(['a', 'a', 'b'])).toHaveLength(2);
  });

  it('clear() starts over', () => {
    const pool = new RowPool();
    pool.update(range(0, 4));
    pool.pin('r0');
    pool.clear();
    expect(pool.size).toBe(0);
    expect(pool.pinned).toBeUndefined();
    expect(pool.update(['x'])).toEqual([{ id: 'x', slot: 0 }]);
  });
});
