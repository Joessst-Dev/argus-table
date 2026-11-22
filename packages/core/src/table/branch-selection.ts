import { isGroupId } from './group-rows.js';
import type { RowStructure } from './row-structure.js';
import type { TreeForest, TreeLayout } from './tree-order.js';
import type { BranchCheck, BranchTree } from '../state/selection.js';

type Tree = TreeForest['tree'];

/** Whether a row has a child the filters hide that isn't selected. */
type MissesHidden = (
  tree: Tree,
  layout: TreeLayout,
  row: number,
  selected: ReadonlySet<string>,
) => boolean;

/**
 * `branchCheck`'s marks of a subtree: some row the user can tick is selected
 * (`PICKED`) or isn't (`MISSED`), some row can be ticked (`LIVE`), some row is
 * blocked (`DEAD`: ticking it could select nothing), some row that can be
 * ticked doesn't count as checked (`UNMET`).
 */
const PICKED = 1;
const MISSED = 2;
const LIVE = 4;
const DEAD = 8;
const UNMET = 16;

/** Each kept row's checkbox for a selection, and the select-all checkbox's. */
interface Checks {
  check: (index: number) => BranchCheck;
  all: BranchCheck;
}

const NO_CHECKS: Checks = { check: () => 'none', all: 'none' };

/**
 * Branch selection over the shown rows' forest (`RowStructure.forest()`): the
 * checkboxes' states, select-all, and the `BranchTree` the selection rules
 * walk. Each is kept per tree layout (a filter or sort result).
 */
export class BranchSelection {
  readonly #structure: () => RowStructure;
  /** Whether the rows come from a remote that arranges its own (`RemoteTree`). */
  readonly #remoteTree: () => boolean;
  #branches: { layout: TreeLayout; tree: BranchTree } | undefined;
  #checks: (Checks & { layout: TreeLayout | undefined; selected: ReadonlySet<string> }) | undefined;
  // Every row's children in the whole tree (filters not applied), by source
  // index: `kids[start[i]]` up to `kids[start[i + 1]]`. Built per tree, the
  // first time a filter hides some row's children.
  #family: { tree: Tree; start: Int32Array; kids: Int32Array } | undefined;

  constructor(structure: () => RowStructure, remoteTree: () => boolean) {
    this.#structure = structure;
    this.#remoteTree = remoteTree;
  }

  /**
   * Each kept row's checkbox for a selection, and the select-all checkbox's,
   * in one pass over the kept rows, preorder backwards (every row comes after
   * its descendants). Kept per selection `Set` and layout.
   *
   * A row is blocked when ticking it could select nothing: its id isn't
   * selected, a descendant left unselected keeps it out (one the filters hide,
   * or a blocked one), and none of its kept descendants can be ticked. Blocked
   * rows count for nothing else: not as unselected rows of their ancestors'
   * branches, not for the select-all checkbox.
   */
  checks(selected: ReadonlySet<string>): Checks {
    const steps = this.#structure().forest();
    const layout = steps?.layout;
    const cached = this.#checks;
    if (cached?.selected === selected && cached.layout === layout) return cached;
    this.#checks = { layout, selected, ...this.#marked(steps, selected) };
    return this.#checks;
  }

  #marked(steps: TreeForest | undefined, selected: ReadonlySet<string>): Checks {
    // Without a selection, only a filter can block rows. A remote tree with no
    // rows loaded (reloading) shows nothing yet.
    const count = steps?.layout.order.length ?? 0;
    if (
      !steps ||
      (count === 0 && this.#remoteTree()) ||
      (selected.size === 0 && count >= steps.tree.ids.length)
    ) {
      return NO_CHECKS;
    }
    const { tree, layout } = steps;
    const marks = branchMarks(tree, layout, selected, this.#missesHidden);
    // The top-level kept rows' marks hold every row's.
    let top = 0;
    for (const row of layout.children(-1)) top |= marks[row] ?? 0;
    return {
      check: (index) => {
        const row = this.#structure().forestRow(index);
        const mark = row === undefined ? 0 : (marks[row] ?? 0);
        if (row !== undefined && !(mark & LIVE)) return 'blocked';
        return mark & PICKED ? (mark & MISSED ? 'some' : 'all') : 'none';
      },
      all: !(top & LIVE) ? 'blocked' : top & UNMET ? (top & PICKED ? 'some' : 'none') : 'all',
    };
  }

  /**
   * The ids select-all gives with the current selection: every kept row's,
   * except rows whose branch can't end up whole (a descendant the filters hide
   * isn't selected), whose ids are dropped from the selection too.
   */
  selectAll(current: readonly string[], selected: ReadonlySet<string>): string[] {
    const steps = this.#structure().forest();
    if (!steps) return [...current];
    const { tree, layout } = steps;
    const { broken, drop } = this.#brokenBranches(tree, layout, selected);
    const all = drop.size === 0 ? [...current] : current.filter((id) => !drop.has(id));
    for (const row of layout.order) {
      const id = tree.ids[row] ?? '';
      if (!broken[row] && !selected.has(id)) all.push(id);
    }
    return all;
  }

  /**
   * Per kept row, 1 when its branch can't end up whole: a descendant the
   * filters hide isn't selected. Preorder backwards, children first. `drop`:
   * those rows' ids selected against the rules (normalized, as
   * `withBranches` does).
   */
  #brokenBranches(
    tree: Tree,
    layout: TreeLayout,
    selected: ReadonlySet<string>,
  ): { broken: Uint8Array; drop: Set<string> } {
    const { parent, ids } = tree;
    const { order } = layout;
    const broken = new Uint8Array(parent.length);
    const drop = new Set<string>();
    for (let k = order.length - 1; k >= 0; k--) {
      const row = order[k] ?? 0;
      if (!broken[row] && this.#missesHidden(tree, layout, row, selected)) broken[row] = 1;
      if (!broken[row]) continue;
      const up = parent[row] ?? -1;
      if (up !== -1) broken[up] = 1;
      const id = ids[row] ?? '';
      if (selected.has(id)) drop.add(id);
    }
    return { broken, drop };
  }

  /** The kept rows' tree for the selection rules, with the whole tree's children. */
  tree(): BranchTree | undefined {
    const steps = this.#structure().forest();
    if (!steps) return undefined;
    const { tree, layout } = steps;
    if (this.#branches?.layout === layout) return this.#branches.tree;
    const idsOf = (kids: Int32Array): string[] => {
      const out = new Array<string>(kids.length);
      for (let k = 0; k < kids.length; k++) out[k] = tree.ids[kids[k] ?? 0] ?? '';
      return out;
    };
    const children = (id: string): string[] => {
      const row = tree.indexOf(id);
      // Rows the filters drop have no kept children.
      if (row === undefined || (layout.keptChildren[row] ?? 0) === 0) return [];
      return idsOf(layout.children(row));
    };
    const branchTree: BranchTree = {
      children,
      allChildren: (id) => {
        const row = tree.indexOf(id);
        const kids = row === undefined ? undefined : this.#fullKids(tree, layout, row);
        return kids ? idsOf(kids) : children(id);
      },
      parent(id) {
        const row = tree.indexOf(id);
        // Only kept rows have a position among their siblings.
        if (row === undefined || (layout.posInSet[row] ?? 0) === 0) return undefined;
        const up = tree.parent[row] ?? -1;
        return up === -1 ? undefined : tree.ids[up];
      },
    };
    this.#branches = { layout, tree: branchTree };
    return branchTree;
  }

  readonly #missesHidden: MissesHidden = (tree, layout, row, selected) =>
    this.#fullKids(tree, layout, row)?.some(
      (kid) => (layout.posInSet[kid] ?? 0) === 0 && !selected.has(tree.ids[kid] ?? ''),
    ) ?? false;

  /** A row's children in the whole tree, when the filters hide some. */
  #fullKids(tree: Tree, layout: TreeLayout, row: number): Int32Array | undefined {
    if ((layout.keptChildren[row] ?? 0) === (tree.childCount[row] ?? 0)) return undefined;
    const { start, kids } = this.#familyOf(tree);
    return kids.subarray(start[row] ?? 0, start[row + 1] ?? 0);
  }

  #familyOf(tree: Tree): { start: Int32Array; kids: Int32Array } {
    if (this.#family?.tree !== tree) {
      const { parent, childCount } = tree;
      const n = parent.length;
      const start = new Int32Array(n + 1);
      for (let i = 0; i < n; i++) start[i + 1] = (start[i] ?? 0) + (childCount[i] ?? 0);
      const kids = new Int32Array(start[n] ?? 0);
      const fill = start.slice(0, n);
      for (let i = 0; i < n; i++) {
        const up = parent[i] ?? -1;
        if (up !== -1) kids[(fill[up] = (fill[up] ?? 0) + 1) - 1] = i;
      }
      this.#family = { tree, start, kids };
    }
    return this.#family;
  }
}

/** Each kept row's marks (see `PICKED`), bottom up: a row's include its kept descendants'. */
function branchMarks(
  tree: Tree,
  layout: TreeLayout,
  selected: ReadonlySet<string>,
  missesHidden: MissesHidden,
): Uint8Array {
  const { parent, ids } = tree;
  const { order } = layout;
  const marks = new Uint8Array(parent.length);
  for (let k = order.length - 1; k >= 0; k--) {
    const row = order[k] ?? 0;
    // Its kept descendants' marks, before its own joins them.
    const below = marks[row] ?? 0;
    const own = selected.has(ids[row] ?? '');
    let mark = below;
    if (!own && !(below & LIVE) && keptOut(below, tree, layout, row, selected, missesHidden)) {
      mark |= DEAD;
    } else {
      // A group row's own id is never selected: it counts as checked when its rows are.
      const group = isGroupId(ids[row] ?? '');
      mark |= LIVE | (own ? PICKED : group ? 0 : MISSED);
      // Checked (as `toggleBranch` decides): every row below that can be
      // ticked is, and its own id selected, or kept out with something
      // below to tick.
      if (
        below & UNMET ||
        !(own || (below & LIVE && keptOut(below, tree, layout, row, selected, missesHidden)))
      ) {
        mark |= UNMET;
      }
    }
    marks[row] = mark;
    const up = parent[row] ?? -1;
    if (up !== -1) marks[up] = (marks[up] ?? 0) | mark;
  }
  return marks;
}

/** Whether a row's own id is kept out by a descendant left unselected (hidden, or blocked). */
function keptOut(
  below: number,
  tree: Tree,
  layout: TreeLayout,
  row: number,
  selected: ReadonlySet<string>,
  missesHidden: MissesHidden,
): boolean {
  return (below & (MISSED | DEAD)) !== 0 || missesHidden(tree, layout, row, selected);
}
