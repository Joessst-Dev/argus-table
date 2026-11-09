import { describe, expect, it } from 'vitest';
import { clickSelection, sameSelection, selectAll, selectRange, toggleRow } from './selection.js';

/** Rows `r0`… by index; `missing` indices aren't loaded. */
const idAt =
  (missing: readonly number[] = []) =>
  (index: number) =>
    missing.includes(index) ? undefined : `r${String(index)}`;

const plain = { toggle: false, range: false };
const toggle = { toggle: true, range: false };
const range = { toggle: false, range: true };
const addRange = { toggle: true, range: true };

describe('sameSelection', () => {
  it('compares ids in any order', () => {
    expect(sameSelection(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSelection(['a'], ['a', 'b'])).toBe(false);
    expect(sameSelection(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameSelection([], [])).toBe(true);
  });
});

describe('toggleRow', () => {
  it('adds and removes a row in multi mode, and anchors on it', () => {
    expect(toggleRow(['a'], 'multi', 'b')).toEqual({ selection: ['a', 'b'], anchor: 'b' });
    expect(toggleRow(['a', 'b'], 'multi', 'a')).toEqual({ selection: ['b'], anchor: 'a' });
  });

  it('replaces the selection in single mode, and can clear it', () => {
    expect(toggleRow(['a'], 'single', 'b')).toEqual({ selection: ['b'], anchor: 'b' });
    expect(toggleRow(['b'], 'single', 'b')).toEqual({ selection: [], anchor: 'b' });
  });

  it('does nothing in none mode', () => {
    expect(toggleRow([], 'none', 'a')).toBeUndefined();
  });
});

describe('selectRange', () => {
  it('selects both ends and everything between, in row order', () => {
    expect(selectRange(['x'], 2, 4, idAt(), false)).toEqual(['r2', 'r3', 'r4']);
    expect(selectRange([], 4, 2, idAt(), false)).toEqual(['r2', 'r3', 'r4']);
  });

  it('adds to the selection without repeating ids', () => {
    expect(selectRange(['r3', 'x'], 2, 4, idAt(), true)).toEqual(['r3', 'x', 'r2', 'r4']);
  });

  it('leaves out rows that are not loaded', () => {
    expect(selectRange([], 0, 3, idAt([1, 2]), false)).toEqual(['r0', 'r3']);
  });
});

describe('selectAll', () => {
  it('adds every id, keeping the ones already selected', () => {
    expect(selectAll(['x', 'r1'], ['r0', 'r1', 'r2'])).toEqual(['x', 'r1', 'r0', 'r2']);
  });
});

describe('clickSelection', () => {
  const at = (index: number) => ({ id: `r${String(index)}`, index });

  it('selects only the clicked row on a plain click', () => {
    expect(clickSelection(['r1', 'r2'], 'multi', at(5), undefined, plain, idAt())).toEqual({
      selection: ['r5'],
      anchor: 'r5',
    });
    expect(clickSelection(['r1'], 'single', at(5), at(1), plain, idAt())).toEqual({
      selection: ['r5'],
      anchor: 'r5',
    });
  });

  it('keeps a selected row selected on a plain click', () => {
    const step = clickSelection(['r5'], 'single', at(5), at(5), plain, idAt());
    expect(step?.selection).toEqual(['r5']);
  });

  it('toggles with Ctrl or Cmd', () => {
    expect(clickSelection(['r1'], 'multi', at(5), at(1), toggle, idAt())).toEqual({
      selection: ['r1', 'r5'],
      anchor: 'r5',
    });
    expect(clickSelection(['r5'], 'single', at(5), at(5), toggle, idAt())).toEqual({
      selection: [],
      anchor: 'r5',
    });
  });

  it('selects the range from the anchor with Shift, keeping the anchor', () => {
    expect(clickSelection(['r9'], 'multi', at(4), at(2), range, idAt())).toEqual({
      selection: ['r2', 'r3', 'r4'],
      anchor: 'r2',
    });
  });

  it('adds the range with Ctrl+Shift', () => {
    expect(clickSelection(['r9'], 'multi', at(1), at(2), addRange, idAt())).toEqual({
      selection: ['r9', 'r1', 'r2'],
      anchor: 'r2',
    });
  });

  it('treats Shift as a plain click without an anchor, or in single mode', () => {
    expect(clickSelection(['r9'], 'multi', at(4), undefined, range, idAt())).toEqual({
      selection: ['r4'],
      anchor: 'r4',
    });
    expect(clickSelection(['r9'], 'single', at(4), at(2), range, idAt())).toEqual({
      selection: ['r4'],
      anchor: 'r4',
    });
  });

  it('does nothing in none mode', () => {
    expect(clickSelection([], 'none', at(1), undefined, plain, idAt())).toBeUndefined();
  });
});
