import type { RowState } from '../data/page-cache.js';
import type { TableModelOptions, TreeRowInfo } from './model-types.js';
import type { RowPipeline } from './row-pipeline.js';
import type { TreeForest } from './tree-order.js';

/**
 * The row a stand-in id holds (`RowStructure.standIn`). `same` is `false` when
 * that row is gone and `index` is a replacement (a child row's parent, or its
 * nearest shown ancestor); `moves` when rows loading above can move it (a data
 * source's tree), so the holder looks it up again each update.
 */
export interface StandIn {
  index: number;
  same: boolean;
  moves: boolean;
}

/**
 * How the shown rows are arranged: flat or as a tree, loaded or not. Every
 * index is a shown index (the body's data indexes, what `TableModel.rowAt`
 * takes). The model reads its rows' arrangement only through this, so a new
 * arrangement (row grouping) is a new implementation, not a branch in each
 * caller. Implemented by `ModelRows` (`data`, and a flat data source) and
 * `RemoteTree` (a data source's tree).
 */
export interface RowStructure {
  /** Whether the rows form a tree. */
  readonly tree: boolean;
  stateAt(index: number): RowState;
  /** A loaded row's id, without building a row view; `undefined` when not loaded or out of range. */
  idAt(index: number): string | undefined;
  /**
   * The id of a row not loaded: one that names what doesn't move as rows load
   * above it. Reserved strings (`\u0000…`) when real ids could look like indexes.
   */
  standInId(index: number): string;
  /** The row a stand-in id from `standInId` holds; `undefined` for any other id. */
  standIn(id: string): StandIn | undefined;
  /** The parent's shown index, for loaded rows and placeholders; `undefined` at the top level or without a tree. */
  parentAt(index: number): number | undefined;
  /** Where a loaded row sits in the tree; `undefined` without a tree or for rows not loaded. */
  treeRow(index: number): TreeRowInfo | undefined;
  /** The depth of a row, loaded or not; `undefined` without a tree or out of range. */
  depthAt(index: number): number | undefined;
  /** The id a click on the row's tree toggle changes: a loaded tree row a filter doesn't keep open. */
  toggleId(index: number): string | undefined;
  /**
   * Whether `treeExpanded` may gain (`open`) or lose this id. Ids of rows not
   * shown count too: a controlled host's ids are never refused for a filter.
   */
  mayToggle(rowId: string, open: boolean): boolean;
  /** The row's shown index, else its nearest shown ancestor's; `undefined` when none is. */
  shownAncestor(rowId: string): number | undefined;
  /** The rows branch selection runs on; `undefined` without a tree. */
  forest(): TreeForest | undefined;
  /** The forest row of the row at a shown index; `undefined` for rows not loaded. */
  forestRow(index: number): number | undefined;
}

/** A stand-in id that is the index itself, or a reserved string when ids could look like one. */
export function plainStandInId(index: number, reserved: boolean): string {
  return reserved ? `\u0000${String(index)}` : String(index);
}

/** The row of a `plainStandInId` id. */
export function plainStandIn(id: string, reserved: boolean): StandIn | undefined {
  const digits = reserved ? (id.startsWith('\u0000') ? id.slice(1) : '') : id;
  return /^\d+$/.test(digits) ? { index: Number(digits), same: true, moves: false } : undefined;
}

/**
 * The rows the model arranges itself: `data`, flat or as a tree (`getSubRows`,
 * `getParentId`), and a flat data source's rows (`PageCache`, or any
 * `RemoteRows` without a `structure`), which are never a tree. Reads the
 * pipeline's memoized steps; for `data`, a shown index is a position in
 * `rows()`, whose entries are source indexes.
 */
export class ModelRows<TData, TContent> implements RowStructure {
  readonly #pipeline: RowPipeline<TData, TContent>;
  readonly #options: () => TableModelOptions<TData, TContent>;

  constructor(
    pipeline: RowPipeline<TData, TContent>,
    options: () => TableModelOptions<TData, TContent>,
  ) {
    this.#pipeline = pipeline;
    this.#options = options;
  }

  get tree(): boolean {
    return this.#pipeline.tree() !== undefined;
  }

  stateAt(index: number): RowState {
    return this.#options().remote?.stateAt?.(index) ?? 'loaded';
  }

  idAt(index: number): string | undefined {
    const { remote } = this.#options();
    if (remote) return remote.entryAt(index)?.id;
    const row = this.#pipeline.rows()[index];
    return row === undefined ? undefined : this.#pipeline.rowId(row);
  }

  standInId(index: number): string {
    return plainStandInId(index, Boolean(this.#options().getRowId));
  }

  standIn(id: string): StandIn | undefined {
    return plainStandIn(id, Boolean(this.#options().getRowId));
  }

  parentAt(index: number): number | undefined {
    return this.treeRow(index)?.parent;
  }

  treeRow(index: number): TreeRowInfo | undefined {
    const pipeline = this.#pipeline;
    const steps = pipeline.treeSteps();
    const row = steps && pipeline.rows()[index];
    if (!steps || row === undefined) return undefined;
    const { tree, layout } = steps;
    const up = tree.parent[row] ?? -1;
    const hasChildren = (layout.keptChildren[row] ?? 0) > 0;
    // A shown row's parent is shown too (kept and open).
    const parent = up === -1 ? -1 : pipeline.orderIndexOf(up);
    return {
      depth: tree.depth[row] ?? 0,
      hasChildren,
      open: hasChildren && pipeline.treeOpen(row),
      forced: hasChildren && steps.holdsMatch?.[row] === 1,
      parent: parent === -1 ? undefined : parent,
      setSize: up === -1 ? steps.roots : (layout.keptChildren[up] ?? 0),
      posInSet: layout.posInSet[row] ?? 0,
    };
  }

  depthAt(index: number): number | undefined {
    const tree = this.#pipeline.tree();
    const row = tree && this.#pipeline.rows()[index];
    return row === undefined ? undefined : (tree?.depth[row] ?? 0);
  }

  toggleId(index: number): string | undefined {
    const info = this.treeRow(index);
    // A row a filter keeps open stays so until the filter clears: nothing changes invisibly.
    return info && !info.forced ? this.idAt(index) : undefined;
  }

  /** Any row with children in the whole tree: filters aren't applied. */
  mayToggle(rowId: string): boolean {
    const tree = this.#pipeline.tree();
    const row = tree?.indexOf(rowId);
    return row !== undefined && (tree?.childCount[row] ?? 0) > 0;
  }

  shownAncestor(rowId: string): number | undefined {
    const pipeline = this.#pipeline;
    const tree = pipeline.tree();
    let row = tree?.indexOf(rowId);
    if (!tree || row === undefined) return undefined;
    while (row !== -1) {
      const index = pipeline.orderIndexOf(row);
      if (index !== -1) return index;
      row = tree.parent[row] ?? -1;
    }
    return undefined;
  }

  forest(): TreeForest | undefined {
    return this.#pipeline.treeSteps();
  }

  forestRow(index: number): number | undefined {
    return this.#pipeline.rows()[index];
  }
}
