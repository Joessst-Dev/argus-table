import { describe, expect, it } from 'vitest';
import { spreadWidth } from './spread-width.js';

const col = (id: string, width: number, minWidth = 40, maxWidth = Infinity) => ({
  id,
  width,
  minWidth,
  maxWidth,
});
const widths = (m: Map<string, number>) => Object.fromEntries(m);

describe('spreadWidth', () => {
  it('spreads in proportion to the widths', () => {
    expect(widths(spreadWidth([col('a', 100), col('b', 300)], 600))).toEqual({ a: 150, b: 450 });
    expect(widths(spreadWidth([col('a', 100), col('b', 300)], 200))).toEqual({ a: 50, b: 150 });
  });

  it('keeps a column at its bound and gives the rest to the others', () => {
    expect(widths(spreadWidth([col('a', 100, 80), col('b', 300)], 200))).toEqual({
      a: 80,
      b: 120,
    });
    expect(widths(spreadWidth([col('a', 100, 40, 110), col('b', 100)], 400))).toEqual({
      a: 110,
      b: 290,
    });
  });

  it('stops at the bounds when the total is out of reach', () => {
    expect(widths(spreadWidth([col('a', 100, 60), col('b', 100, 70)], 50))).toEqual({
      a: 60,
      b: 70,
    });
  });

  it('gives whole px that add up to the total', () => {
    const out = spreadWidth([col('a', 100), col('b', 100), col('c', 100)], 301);
    expect([...out.values()].reduce((s, w) => s + w, 0)).toBe(301);
    expect([...out.values()].every(Number.isInteger)).toBe(true);
  });

  it('shares equally among columns of no width', () => {
    expect(widths(spreadWidth([col('a', 0, 0), col('b', 0, 0)], 100))).toEqual({ a: 50, b: 50 });
  });
});
