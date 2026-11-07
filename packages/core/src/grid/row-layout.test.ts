import { describe, expect, it } from 'vitest';
import { RowLayout } from './row-layout.js';

describe('RowLayout', () => {
  const layout = new RowLayout(2, 5, 1);

  it('counts every row, header included', () => {
    expect(layout.total).toBe(9);
  });

  it('numbers the header, then top, body and bottom rows', () => {
    expect(layout.position({ section: 'header', index: 0 })).toBe(0);
    expect(layout.position({ section: 'top', index: 0 })).toBe(1);
    expect(layout.position({ section: 'top', index: 1 })).toBe(2);
    expect(layout.position({ section: 'body', index: 0 })).toBe(3);
    expect(layout.position({ section: 'body', index: 4 })).toBe(7);
    expect(layout.position({ section: 'bottom', index: 0 })).toBe(8);
  });

  it('maps positions back to rows', () => {
    for (let p = 0; p < layout.total; p++) {
      const row = layout.at(p);
      expect(row).toBeDefined();
      if (row) expect(layout.position(row)).toBe(p);
    }
    expect(layout.at(1)).toEqual({ section: 'top', index: 0 });
    expect(layout.at(3)).toEqual({ section: 'body', index: 0 });
    expect(layout.at(8)).toEqual({ section: 'bottom', index: 0 });
  });

  it('has no row outside the grid', () => {
    expect(layout.at(-1)).toBeUndefined();
    expect(layout.at(9)).toBeUndefined();
  });

  it('is aria-rowindex minus one', () => {
    expect(layout.ariaRowIndex({ section: 'body', index: 0 })).toBe(4);
    expect(layout.fromAriaRowIndex(4)).toEqual({ section: 'body', index: 0 });
    expect(layout.fromAriaRowIndex(1)).toEqual({ section: 'header', index: 0 });
  });

  it('skips empty sections', () => {
    const plain = new RowLayout(0, 3, 0);
    expect(plain.at(1)).toEqual({ section: 'body', index: 0 });
    expect(plain.position({ section: 'body', index: 2 })).toBe(3);
    const noBody = new RowLayout(1, 0, 1);
    expect(noBody.at(1)).toEqual({ section: 'top', index: 0 });
    expect(noBody.at(2)).toEqual({ section: 'bottom', index: 0 });
  });
});
