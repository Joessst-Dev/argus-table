import { describe, expect, it } from 'vitest';
import { RowSizes } from './row-sizes.js';

/** The same answers, the slow way. */
function naive(sizes: number[]) {
  const startOf = (index: number) => sizes.slice(0, index).reduce((a, b) => a + b, 0);
  const indexAt = (offset: number) => {
    if (sizes.length === 0 || !(offset > 0)) return 0;
    let start = 0;
    for (let i = 0; i < sizes.length; i++) {
      start += sizes[i] ?? 0;
      if (start > offset) return i;
    }
    return sizes.length - 1;
  };
  return { startOf, indexAt, total: startOf(sizes.length) };
}

/** A small deterministic random number generator. */
function random(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
}

describe('RowSizes', () => {
  it('is all estimate before anything is measured', () => {
    const s = new RowSizes();
    s.reset(10, 40);
    expect(s.total).toBe(400);
    expect(s.sizeOf(3)).toBe(40);
    expect(s.startOf(3)).toBe(120);
    expect(s.startOf(10)).toBe(400);
    expect(s.indexAt(0)).toBe(0);
    expect(s.indexAt(119.9)).toBe(2);
    expect(s.indexAt(120)).toBe(3);
    expect(s.indexAt(10_000)).toBe(9);
    expect(s.indexAt(-5)).toBe(0);
  });

  it('places rows after measured ones', () => {
    const s = new RowSizes();
    s.reset(5, 40);
    expect(s.set(1, 100)).toBe(60);
    expect(s.set(1, 100)).toBe(0);
    expect(s.sizeOf(1)).toBe(100);
    expect(s.startOf(2)).toBe(140);
    expect(s.total).toBe(260);
    expect(s.indexAt(139)).toBe(1);
    expect(s.indexAt(140)).toBe(2);
    expect(s.set(1, 40)).toBe(-60);
    expect(s.total).toBe(200);
  });

  it('starts over with known sizes, ignoring indexes out of range', () => {
    const s = new RowSizes();
    s.reset(4, 40, [
      [0, 50],
      [3, 70],
      [9, 999],
      [-1, 999],
    ]);
    expect([0, 1, 2, 3].map((i) => s.sizeOf(i))).toEqual([50, 40, 40, 70]);
    expect(s.total).toBe(200);
    s.reset(4, 32);
    expect(s.total).toBe(128);
    expect(s.sizeOf(0)).toBe(32);
  });

  it('keeps the sizes of the rows that stay when the count changes', () => {
    const s = new RowSizes();
    s.reset(3, 40, [[2, 90]]);
    s.resize(6);
    expect(s.total).toBe(6 * 40 + 50);
    expect(s.startOf(3)).toBe(170);
    s.resize(2);
    expect(s.total).toBe(80);
    s.resize(3);
    expect(s.sizeOf(2)).toBe(40);
  });

  it('handles no rows', () => {
    const s = new RowSizes();
    s.reset(0, 40);
    expect(s.total).toBe(0);
    expect(s.indexAt(100)).toBe(0);
    expect(s.set(0, 50)).toBe(0);
  });

  it('agrees with summing every row, after many changes', () => {
    const next = random(7);
    for (const count of [1, 2, 3, 7, 64, 100, 257]) {
      const sizes = Array.from({ length: count }, () => 40);
      const s = new RowSizes();
      s.reset(count, 40);
      for (let n = 0; n < 300; n++) {
        const index = Math.floor(next() * count);
        const px = 40 + Math.round(next() * 8) * 12.5;
        sizes[index] = px;
        s.set(index, px);
      }
      const check = naive(sizes);
      expect(s.total).toBeCloseTo(check.total, 6);
      for (let i = 0; i <= count; i++) expect(s.startOf(i)).toBeCloseTo(check.startOf(i), 6);
      for (let n = 0; n < 200; n++) {
        const offset = next() * (check.total + 100) - 20;
        expect(s.indexAt(offset)).toBe(check.indexAt(offset));
      }
      // Every row's own start finds that row.
      for (let i = 0; i < count; i++) expect(s.indexAt(check.startOf(i))).toBe(i);
    }
  });

  it('stays fast for a million rows', () => {
    const s = new RowSizes();
    s.reset(1_000_000, 40);
    const t = performance.now();
    for (let i = 0; i < 1000; i++) {
      s.set(i * 7, 64);
      s.indexAt(s.startOf(i * 997));
    }
    expect(performance.now() - t).toBeLessThan(200);
    expect(s.total).toBe(40_000_000 + 1000 * 24);
  });
});
