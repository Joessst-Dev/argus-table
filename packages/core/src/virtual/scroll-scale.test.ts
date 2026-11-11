import { describe, expect, it } from 'vitest';
import { ScrollScale } from './scroll-scale.js';

/** 1M rows of 40 px under a 16M px cap; the header and pinned rows add 80 px, the viewport is 600 px. */
const big = () => {
  const scale = new ScrollScale();
  scale.configure(40_000_000, 16_000_000);
  return scale;
};
const range = 16_000_000 + 80 - 600;

describe('ScrollScale', () => {
  it('is the identity under the cap', () => {
    const scale = new ScrollScale();
    scale.configure(400_000, 16_000_000);
    expect(scale.scaled).toBe(false);
    expect(scale.size).toBe(400_000);
    expect(scale.excess).toBe(0);
    expect(scale.toLogical(1234.5, 399_480)).toBe(1234.5);
    expect(scale.toPhysical(1234.5, 399_480)).toBe(1234.5);
  });

  it('renders the body at the cap above it', () => {
    const scale = big();
    expect(scale.scaled).toBe(true);
    expect(scale.size).toBe(16_000_000);
    expect(scale.excess).toBe(24_000_000);
  });

  it('maps the ends of the scroll ranges onto each other', () => {
    const scale = big();
    expect(scale.toLogical(0, range)).toBe(0);
    expect(scale.toLogical(range, range)).toBe(range + 24_000_000);
    expect(scale.toPhysical(0, range)).toBe(0);
    expect(scale.toPhysical(range + 24_000_000, range)).toBe(range);
  });

  it('clamps offsets outside the ranges', () => {
    const scale = big();
    expect(scale.toLogical(-50, range)).toBe(0);
    expect(scale.toLogical(range + 50, range)).toBe(range + 24_000_000);
    expect(scale.toPhysical(-50, range)).toBe(0);
    expect(scale.toPhysical(1e12, range)).toBe(range);
  });

  it('is monotonic and round-trips', () => {
    const scale = big();
    let prev = -1;
    for (let physical = 0; physical <= range; physical += range / 97) {
      const logical = scale.toLogical(physical, range);
      expect(logical).toBeGreaterThan(prev);
      expect(scale.toPhysical(logical, range)).toBeCloseTo(physical, 3);
      prev = logical;
    }
  });

  it('gives back the exact logical offset a write landed on', () => {
    const scale = big();
    const target = 20_000_040;
    const physical = Math.round(scale.toPhysical(target, range));
    expect(scale.toLogical(physical, range)).not.toBe(target);
    scale.land(target, physical);
    expect(scale.toLogical(physical, range)).toBe(target);
    // Any other offset maps as usual.
    expect(scale.toLogical(physical + 1, range)).not.toBe(target);
  });

  it('forgets a landed offset once the rows change', () => {
    const scale = big();
    scale.land(123, 45);
    expect(scale.configure(40_000_040, 16_000_000)).toBe(true);
    expect(scale.toLogical(45, range)).not.toBe(123);
    expect(scale.configure(40_000_040, 16_000_000)).toBe(false);
  });

  it('ignores landing while unscaled', () => {
    const scale = new ScrollScale();
    scale.configure(400_000, 16_000_000);
    scale.land(123, 45);
    expect(scale.toLogical(45, 399_480)).toBe(45);
  });
  describe('pivot', () => {
    /** The body grew by 5000 px of measured rows; the view stays at physical 4M, logical 10M. */
    const pivoted = () => {
      const scale = new ScrollScale();
      scale.configure(40_005_000, 16_000_000);
      scale.pivot(4_000_000, 10_000_000, range);
      return scale;
    };
    const total = range + 24_005_000;

    it('keeps the offset in view where it was', () => {
      const scale = pivoted();
      expect(scale.toLogical(4_000_000, range)).toBe(10_000_000);
      expect(scale.toPhysical(10_000_000, range)).toBe(4_000_000);
    });

    it('still maps the ends onto each other', () => {
      const scale = pivoted();
      expect(scale.toLogical(0, range)).toBe(0);
      expect(scale.toLogical(range, range)).toBe(total);
      expect(scale.toPhysical(0, range)).toBe(0);
      expect(scale.toPhysical(total, range)).toBe(range);
    });

    it('is monotonic and round-trips on both sides', () => {
      const scale = pivoted();
      let previous = -1;
      for (let p = 0; p <= range; p += range / 97) {
        const l = scale.toLogical(p, range);
        expect(l).toBeGreaterThan(previous);
        previous = l;
        expect(scale.toPhysical(l, range)).toBeCloseTo(p, 4);
      }
    });

    it('is dropped by configure(), a new range, and at the ends', () => {
      const scale = pivoted();
      scale.configure(40_010_000, 16_000_000);
      expect(scale.toLogical(4_000_000, range)).toBeCloseTo(
        (4_000_000 * (range + 24_010_000)) / range,
        4,
      );
      scale.pivot(4_000_000, 10_000_000, range);
      expect(scale.toLogical(4_000_000, range - 100)).not.toBe(10_000_000);
      scale.pivot(0, 0, range);
      expect(scale.toLogical(range / 2, range)).toBeCloseTo((range + 24_010_000) / 2, 4);
      scale.pivot(range, 30_000_000, range);
      expect(scale.toLogical(range, range)).toBe(range + 24_010_000);
    });

    it('is ignored under the cap', () => {
      const scale = new ScrollScale();
      scale.configure(400_000, 16_000_000);
      scale.pivot(1000, 2000, 399_480);
      expect(scale.toLogical(1000, 399_480)).toBe(1000);
    });

    it('gives way to an offset written and landed', () => {
      const scale = pivoted();
      scale.land(12_345_678, 5_000_000);
      expect(scale.toLogical(5_000_000, range)).toBe(12_345_678);
    });
  });
});
