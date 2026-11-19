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

/**
 * A `BranchTree` from each row's children; rows not listed have none. Rows in
 * `hidden` are the ones a filter drops (with their ancestors kept, as the
 * model keeps them): they're left out of `children` and have no parent.
 */
const branchTree = (
  kids: Record<string, readonly string[]>,
  hidden: readonly string[] = [],
): BranchTree => {
  const parents = new Map<string, string>();
  for (const [parent, children] of Object.entries(kids)) {
    for (const child of children) parents.set(child, parent);
  }
  const dropped = new Set(hidden);
  return {
    children: (id) => (kids[id] ?? []).filter((child) => !dropped.has(child)),
    allChildren: (id) => kids[id] ?? [],
    parent: (id) => (dropped.has(id) ? undefined : parents.get(id)),
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

  it('ticking under a filter selects only kept rows, and no parent missing a hidden one', () => {
    const filtered = branchTree({ A: ['A1', 'A2'], B: ['B1'] }, ['A2']);
    expect(withBranches([], ['A'], filtered)).toEqual(['A1']);
    // With the hidden row already selected, the branch is whole.
    expect(withBranches(['A2'], ['A'], filtered)).toEqual(['A2', 'A', 'A1']);
    expect(withBranches(['A2'], ['A1'], filtered)).toEqual(['A2', 'A1', 'A']);
  });

  it('a hidden row keeps every ancestor out', () => {
    // G{P{P1, P2}, Q}, P2 hidden.
    const tree = branchTree({ G: ['P', 'Q'], P: ['P1', 'P2'] }, ['P2']);
    expect(sameSelection(withBranches([], ['G'], tree), ['P1', 'Q'])).toBe(true);
    expect(withBranches(['Q'], ['P1'], tree)).toEqual(['Q', 'P1']);
    // Ancestors selected against the rules are dropped.
    expect(withBranches(['G', 'P', 'Q'], ['P1'], tree)).toEqual(['Q', 'P1']);
    expect(withBranches(['G', 'P', 'Q'], ['G'], tree)).toEqual(['Q', 'P1']);
  });

  it('a kept parent whose children are all hidden is never ticked', () => {
    const tree = branchTree({ A: ['A1', 'A2'] }, ['A1', 'A2']);
    expect(withBranches([], ['A'], tree)).toEqual([]);
    expect(withBranches(['A1', 'A2'], ['A'], tree)).toEqual(['A1', 'A2', 'A']);
  });

  it('decides a parent after a branch below it walked first', () => {
    // P2 is walked on its own before R reaches it.
    const tree = branchTree({ R: ['P', 'Q'], P: ['P1', 'P2'] });
    expect(sameSelection(withBranches([], ['P1', 'R'], tree), ['R', 'P', 'P1', 'P2', 'Q'])).toBe(
      true,
    );
    const filtered = branchTree({ R: ['P', 'Q'], P: ['P1', 'P2'] }, ['P2']);
    expect(sameSelection(withBranches([], ['P1', 'R'], filtered), ['P1', 'Q'])).toBe(true);
  });

  it('just adds an id that is not in the tree', () => {
    expect(withBranches(['A1'], ['X'], ab)).toEqual(['A1', 'X']);
  });

  it('walks a 100k-deep chain without recursion', () => {
    const depth = 100_000;
    const chain: BranchTree = {
      children: (id) => chain.allChildren(id),
      allChildren: (id) => {
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
    expect(toggleBranch([], String(depth - 1), chain)).toHaveLength(depth);
    expect(toggleBranch(['0', '1', '7', String(depth - 1)], String(depth - 1), chain)).toEqual([]);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('toggleBranch', () => {
  it('toggleBranch deselects a branch and its ancestors', () => {
    expect(toggleBranch(['A', 'A1', 'A2'], 'A1', ab)).toEqual(['A2']);
    expect(toggleBranch(['B1', 'A', 'A1', 'A2'], 'A', ab)).toEqual(['B1']);
  });

  it('selects the branch when it is not all selected', () => {
    expect(sameSelection(toggleBranch(['A1'], 'A', ab), ['A1', 'A', 'A2'])).toBe(true);
    // Selected itself, but not with its whole branch.
    expect(sameSelection(toggleBranch(['A', 'A1'], 'A', ab), ['A', 'A1', 'A2'])).toBe(true);
  });

  it('toggles a leaf, completing or clearing its parent', () => {
    expect(sameSelection(toggleBranch(['B1'], 'A1', ab), ['B1', 'A1'])).toBe(true);
    expect(sameSelection(toggleBranch([], 'B1', ab), ['B1', 'B'])).toBe(true);
    expect(toggleBranch(['B', 'B1', 'A1'], 'B1', ab)).toEqual(['A1']);
  });

  it('leaves descendants the filters hide selected', () => {
    const filtered = branchTree({ A: ['A1', 'A2'] }, ['A2']);
    expect(toggleBranch(['A', 'A1', 'A2'], 'A', filtered)).toEqual(['A2']);
  });

  // P0{C0.0, C0.1, C0.2}, a filter keeping C0.1.
  const p0 = branchTree({ '0': ['0.0', '0.1', '0.2'] }, ['0.0', '0.2']);

  it('under a filter, ticks the shown rows and unticks a parent whose shown rows are all selected', () => {
    // Ticking P0 selects C0.1 only: P0's id needs C0.0 and C0.2.
    const ticked = toggleBranch([], '0', p0);
    expect(ticked).toEqual(['0.1']);
    // P0 counts as checked now, so the next click unticks, then ticks again.
    expect(toggleBranch(ticked, '0', p0)).toEqual([]);
    expect(toggleBranch(toggleBranch(ticked, '0', p0), '0', p0)).toEqual(['0.1']);
    // Ticking C0.1 itself is the same.
    expect(toggleBranch([], '0.1', p0)).toEqual(['0.1']);
    expect(toggleBranch(['0.1'], '0.1', p0)).toEqual([]);
  });

  it('under a filter, adds the parent once the hidden rows are selected too', () => {
    expect(toggleBranch(['0.0', '0.2'], '0', p0)).toEqual(['0.0', '0.2', '0', '0.1']);
    // Unticking removes the shown row and the parent, not the hidden ones.
    expect(toggleBranch(['0.0', '0.2', '0.1', '0'], '0', p0)).toEqual(['0.0', '0.2']);
  });

  it('a whole branch without its parent id ticks, adding the id', () => {
    expect(toggleBranch(['0.0', '0.1', '0.2'], '0', p0)).toEqual(['0.0', '0.1', '0.2', '0']);
    expect(toggleBranch(['A1', 'A2'], 'A', ab)).toEqual(['A1', 'A2', 'A']);
  });

  it('a kept parent whose children are all hidden ticks nothing', () => {
    const tree = branchTree({ A: ['A1', 'A2'] }, ['A1', 'A2']);
    expect(toggleBranch([], 'A', tree)).toEqual([]);
  });

  it('a grandparent counts as checked through a level kept out by hidden rows', () => {
    // Root{Folder{report, other}}, other hidden.
    const tree = branchTree({ Root: ['Folder'], Folder: ['report', 'other'] }, ['other']);
    expect(toggleBranch([], 'Root', tree)).toEqual(['report']);
    expect(toggleBranch(['report'], 'Root', tree)).toEqual([]);
    expect(toggleBranch(['report'], 'Folder', tree)).toEqual([]);
    expect(toggleBranch(['report'], 'report', tree)).toEqual([]);
  });

  it('blocked descendants count for nothing but keep their ancestors out', () => {
    // G{P{P1, P2}, Q}, with P kept and its children hidden: P is blocked.
    const tree = branchTree({ G: ['P', 'Q'], P: ['P1', 'P2'] }, ['P1', 'P2']);
    expect(toggleBranch([], 'G', tree)).toEqual(['Q']);
    // Q is all there is to tick: G counts as checked, and unticks.
    expect(toggleBranch(['Q'], 'G', tree)).toEqual([]);
    expect(toggleBranch(['Q'], 'P', tree)).toEqual(['Q']);
    // With P's children selected, P isn't blocked: G isn't checked.
    expect(
      sameSelection(toggleBranch(['Q', 'P1', 'P2'], 'G', tree), ['Q', 'P1', 'P2', 'P', 'G']),
    ).toBe(true);
    // Only blocked rows under G: G is blocked too.
    const only = branchTree({ G: ['P'], P: ['P1'] }, ['P1']);
    expect(toggleBranch([], 'G', only)).toEqual([]);
  });
});

/** A deterministic random number generator (mulberry32). */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('branch selection over random trees and filters', () => {
  it("a parent's id is selected only with its whole branch, and ticks never reach hidden rows", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
      // Up to 25 rows, each under an earlier one or at the top.
      const count = 2 + Math.floor(next() * 24);
      const kids: Record<string, string[]> = {};
      const parentOf = new Map<string, string>();
      for (let i = 1; i < count; i++) {
        if (next() < 0.25) continue;
        const up = String(Math.floor(next() * i));
        (kids[up] ??= []).push(String(i));
        parentOf.set(String(i), up);
      }
      const all = Array.from({ length: count }, (_, i) => String(i));
      const descendants = (id: string): string[] => {
        const out: string[] = [];
        const stack = [...(kids[id] ?? [])];
        while (stack.length > 0) {
          const row = stack.pop() ?? '';
          out.push(row);
          stack.push(...(kids[row] ?? []));
        }
        return out;
      };
      const whole = (selection: readonly string[]) => {
        const has = new Set(selection);
        return selection.every((id) => descendants(id).every((d) => has.has(d)));
      };
      let selection: readonly string[] = [];
      for (let step = 0; step < 30; step++) {
        // A filter: matches, kept with their ancestors (none: no filter).
        const kept = new Set<string>();
        const filtered = next() < 0.6;
        for (const id of all) {
          if (filtered && next() < 0.6) continue;
          for (let up: string | undefined = id; up !== undefined; up = parentOf.get(up)) {
            kept.add(up);
          }
        }
        const shown = all.filter((id) => kept.has(id));
        if (shown.length === 0) continue;
        const tree = branchTree(
          kids,
          all.filter((id) => !kept.has(id)),
        );
        const before = new Set(selection);
        const op = next();
        const id = pick(shown);
        let after: readonly string[];
        if (op < 0.5) after = toggleBranch(selection, id, tree);
        else if (op < 0.65) after = withBranches([], [id], tree);
        else if (op < 0.85) {
          const from = shown.indexOf(id);
          const to = Math.floor(next() * shown.length);
          after = withBranches(
            next() < 0.5 ? selection : [],
            shown.slice(Math.min(from, to), Math.max(from, to) + 1),
            tree,
          );
        } else after = withBranches(selection, shown, tree);
        expect(whole(after), `seed ${String(seed)} step ${String(step)}`).toBe(true);
        expect(new Set(after).size).toBe(after.length);
        for (const row of after) {
          if (!kept.has(row)) expect(before.has(row)).toBe(true);
        }
        // Without a filter, ticking a row selects its whole branch.
        if (!filtered && op >= 0.5 && op < 0.65) {
          expect(after).toEqual(expect.arrayContaining([id, ...descendants(id)]));
        }
        selection = after;
      }
    }
  });
});
