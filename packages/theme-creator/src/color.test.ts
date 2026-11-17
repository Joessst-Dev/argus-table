import { describe, expect, it } from 'vitest';
import {
  contrast,
  ensureContrast,
  formatColor,
  fromOklch,
  mix,
  parseColor,
  toOklch,
  type Rgb,
} from './color.js';

const rgb = (css: string): Rgb => {
  const color = parseColor(css);
  if (!color) throw new Error(`not a colour: ${css}`);
  return color;
};

describe('parseColor', () => {
  it('reads any CSS colour', () => {
    expect(formatColor(rgb('#2f5bd3'))).toBe('#2f5bd3');
    expect(formatColor(rgb('rebeccapurple'))).toBe('#663399');
    expect(formatColor(rgb('rgb(0 0 0 / 0.5)'))).toBe('rgb(0 0 0 / 0.5)');
    expect(formatColor(rgb('color-mix(in srgb, #000 50%, #fff)'))).toMatch(/^#(7f|80){3}$/);
  });

  it('leaves out what it cannot resolve', () => {
    expect(parseColor('var(--x)')).toBeUndefined();
    expect(parseColor('light-dark(#fff, #000)')).toBeUndefined();
    expect(parseColor('2px solid red')).toBeUndefined();
    expect(parseColor('')).toBeUndefined();
  });
});

describe('OKLCH', () => {
  it('round-trips sRGB', () => {
    for (const hex of ['#2f5bd3', '#ffffff', '#000000', '#b45309', '#6750a4'])
      expect(formatColor(fromOklch(toOklch(rgb(hex))))).toBe(hex);
  });

  it('knows white', () => {
    expect(toOklch(rgb('#fff')).l).toBeCloseTo(1, 3);
  });

  it('mixes', () => {
    expect(formatColor(mix(rgb('#ffffff'), rgb('#000000'), 0))).toBe('#ffffff');
    expect(formatColor(mix(rgb('#ffffff'), rgb('#000000'), 1))).toBe('#000000');
  });
});

describe('contrast', () => {
  it('matches WCAG', () => {
    expect(contrast(rgb('#000'), rgb('#fff'))).toBeCloseTo(21, 5);
    expect(contrast(rgb('#777'), rgb('#fff'))).toBeCloseTo(4.48, 2);
  });

  it('paints a translucent colour over the background', () => {
    expect(contrast(rgb('rgb(0 0 0 / 0)'), rgb('#fff'))).toBeCloseTo(1, 5);
  });

  it('moves a colour until it passes', () => {
    const fixed = ensureContrast(rgb('#9aa8c8'), rgb('#ffffff'), 4.5);
    expect(contrast(fixed, rgb('#ffffff'))).toBeGreaterThanOrEqual(4.5);
    // Not further than needed.
    expect(contrast(fixed, rgb('#ffffff'))).toBeLessThan(4.7);
    const light = ensureContrast(rgb('#2f5bd3'), rgb('#121212'), 4.5);
    expect(contrast(light, rgb('#121212'))).toBeGreaterThanOrEqual(4.5);
  });
});
