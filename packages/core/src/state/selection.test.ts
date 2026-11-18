import { describe, expect, it } from 'vitest';
import {
  clickSelection,
  sameSelection,
  selectAll,
  selectRange,
  toggleBranch,
  toggleRow,
  withBranches,
  type BranchTree,
} from './selection.js';

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

/** A `BranchTree` from each row's kept children; rows not listed have none. */
const branchTree = (kids: Record<string, readonly string[]>): BranchTree => {
  const parents = new Map<string, string>();
  for (const [parent, children] of Object.entries(kids)) {
    for (const child of children) parents.set(child, parent);
  }
  return {
    children: (id) => kids[id] ?? [],
    parent: (id) => parents.get(id),
  };
};

// A{A1, A2}, B{B1}
const ab = branchTree({ A: ['A1', 'A2'], B: ['B1'] });

describe('withBranches', () => {
  it('withBranches adds descendants and completes parents', () => {
    expect(sameSelection(withBranches([], ['A'], ab), ['A', 'A1', 'A2'])).toBe(true);
    expect(sameSelection(withBranches(['A1'], ['A2'], ab), ['A1', 'A2', 'A'])).toBe(true);
  });

  it('keeps the current order and appends new ids, without duplicates', () => {
    // B1 isn't ticked here: B stays as it is.
    expect(withBranches(['B1', 'A1'], ['A', 'A1'], ab)).toEqual(['B1', 'A1', 'A', 'A2']);
  });

  it('stops at the first ancestor with a child left unselected', () => {
    const deep = branchTree({ R: ['P', 'Q'], P: ['P1', 'P2'] });
    expect(sameSelection(withBranches(['P1'], ['P2'], deep), ['P1', 'P2', 'P'])).toBe(true);
    expect(
      sameSelection(withBranches(['P1', 'Q'], ['P2'], deep), ['P1', 'Q', 'P2', 'P', 'R']),
    ).toBe(true);
  });

  it('completes a parent once a sibling branch completes first', () => {
    const tree = branchTree({ R: ['P', 'Q'], P: ['P1', 'P2'], Q: ['Q1'] });
    expect(
      sameSelection(withBranches(['P1'], ['Q1', 'P2'], tree), ['P1', 'Q1', 'P2', 'Q', 'P', 'R']),
    ).toBe(true);
  });

  it('drops a selected ancestor whose branch is not whole', () => {
    // ['A'] alone breaks the rules: ticking A1 normalizes it.
    const once = withBranches(['A'], ['A1'], ab);
    expect(once).toEqual(['A1']);
    expect(sameSelection(withBranches(once, ['A2'], ab), ['A1', 'A2', 'A'])).toBe(true);
  });

  it('drops every selected ancestor above an incomplete one', () => {
    const tree = branchTree({ G: ['P', 'Q'], P: ['P1', 'P2'] });
    expect(withBranches(['G', 'P', 'Q'], ['P1'], tree)).toEqual(['Q', 'P1']);
    // Not selected itself, P still keeps G from being whole.
    expect(withBranches(['G', 'Q'], ['P1'], tree)).toEqual(['Q', 'P1']);
  });

  it('ticking under a filter selects only kept rows', () => {
    const filtered = branchTree({ A: ['A1'], B: ['B1'] });
    expect(sameSelection(withBranches([], ['A'], filtered), ['A', 'A1'])).toBe(true);
  });

  it('just adds an id that is not in the tree', () => {
    expect(withBranches(['A1'], ['X'], ab)).toEqual(['A1', 'X']);
  });

  it('walks a 100k-deep chain without recursion', () => {
    const depth = 100_000;
    const chain: BranchTree = {
      children: (id) => {
        const n = Number(id);
        return n + 1 < depth ? [String(n + 1)] : [];
      },
      parent: (id) => {
        const n = Number(id);
        return n > 0 ? String(n - 1) : undefined;
      },
    };
    const start = performance.now();
    expect(withBranches([], ['0'], chain)).toHaveLength(depth);
    // The deepest row completes every ancestor on its way up.
    expect(withBranches([], [String(depth - 1)], chain)).toHaveLength(depth);
    expect(toggleBranch([], String(depth - 1), false, chain)).toHaveLength(depth);
    expect(toggleBranch(['0', '1', '7'], String(depth - 1), true, chain)).toEqual([]);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('toggleBranch', () => {
  it('toggleBranch deselects a branch and its ancestors', () => {
    expect(toggleBranch(['A', 'A1', 'A2'], 'A1', true, ab)).toEqual(['A2']);
    expect(toggleBranch(['B1', 'A', 'A1', 'A2'], 'A', true, ab)).toEqual(['B1']);
  });

  it('selects the branch when it is not all selected', () => {
    expect(sameSelection(toggleBranch(['A1'], 'A', false, ab), ['A1', 'A', 'A2'])).toBe(true);
  });

  it('toggles a leaf, completing or clearing its parent', () => {
    expect(sameSelection(toggleBranch(['B1'], 'A1', false, ab), ['B1', 'A1'])).toBe(true);
    expect(sameSelection(toggleBranch([], 'B1', false, ab), ['B1', 'B'])).toBe(true);
    expect(toggleBranch(['B', 'B1', 'A1'], 'B1', true, ab)).toEqual(['A1']);
  });

  it('leaves descendants the filters hide selected', () => {
    const filtered = branchTree({ A: ['A1'] });
    expect(toggleBranch(['A', 'A1', 'A2'], 'A', true, filtered)).toEqual(['A2']);
  });
});
