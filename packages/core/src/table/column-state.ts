import {
  headerGroupRows,
  resolveColumnGroups,
  type GroupTree,
  type HeaderGroupCell,
} from '../columns/column-groups.js';
import { normalizeOrder } from '../columns/column-order.js';
import { resolveColumns, type ResolvedColumn } from '../columns/resolve-columns.js';
import type { ColumnDef, ColumnOrderState, ColumnPin, ColumnSizingState } from '../types.js';
import { buildAllViews, buildViews, hiddenIn, pinIn, sizingOf } from './column-views.js';
import type { ColumnView, TableModelOptions } from './model-types.js';

/**
 * Ids of the columns kept from `before` whose accessor changed: a new function,
 * or a different path. A new column has nothing cached and isn't listed.
 */
function changedAccessors<TData, TContent>(
  before: readonly ColumnDef<TData, TContent>[],
  after: readonly ColumnDef<TData, TContent>[],
): string[] {
  const old = new Map(before.map((c) => [c.id, c.accessor]));
  return after.filter((c) => old.has(c.id) && old.get(c.id) !== c.accessor).map((c) => c.id);
}

/**
 * What the group header rows depend on in the views, beyond their identity:
 * views are rebuilt on every update, the rows only change with this.
 */
function headerGroupKey<TData, TContent>(views: readonly ColumnView<TData, TContent>[]): string {
  return views
    .map(
      (c) =>
        `${c.id}\u0000${String(c.pin)}\u0000${String(c.offset)}\u0000${String(c.pinEdge)}\u0000${String(c.reorderable)}\u0000${String(c.resizable)}`,
    )
    .join('\u0001');
}

/**
 * The columns: resolved from their definitions with their groups, and what the
 * model derives from them and the options (the pin and visibility in effect,
 * sizing, order, views, header group rows), each kept until an update touches
 * what it reads. The options stay the model's: they're read through `options`.
 */
export class ColumnState<TData, TContent> {
  readonly #options: () => TableModelOptions<TData, TContent>;
  resolved: ResolvedColumn<TData, TContent>[];
  byId: Map<string, ResolvedColumn<TData, TContent>>;
  tree: GroupTree<TContent>;
  #views: ColumnView<TData, TContent>[] | undefined;
  #allViews: ColumnView<TData, TContent>[] | undefined;
  // The sizing state in effect: measured auto widths and the widths of pinned flex columns
  // under the resized ones. Kept stable between updates that don't touch them.
  #sizing: ColumnSizingState | undefined;
  // The normalized order, kept stable between updates that touch neither columns,
  // order nor pinning.
  #order: ColumnOrderState | undefined;
  // The group header rows, kept while the tree and what they read of the views stay.
  #groupRows:
    | {
        views: readonly ColumnView<TData, TContent>[];
        tree: GroupTree<TContent>;
        key: string;
        rows: HeaderGroupCell<TContent>[][];
      }
    | undefined;

  constructor(options: () => TableModelOptions<TData, TContent>) {
    this.#options = options;
    const { columns, columnGroups } = options();
    this.resolved = resolveColumns(columns);
    this.byId = new Map(this.resolved.map((c) => [c.id, c]));
    this.tree = this.#treeOf(columnGroups);
  }

  /**
   * Takes the options an update will store (`merged`, from the current ones and
   * `next`), before they're stored: re-resolves new columns, drops what they
   * invalidate, and returns the ids of columns whose accessor changed.
   */
  update(
    next: Partial<TableModelOptions<TData, TContent>>,
    merged: TableModelOptions<TData, TContent>,
  ): string[] {
    const prev = this.#options();
    let reread: string[] = [];
    if (next.columns && next.columns !== prev.columns) {
      reread = changedAccessors(prev.columns, next.columns);
      this.resolved = resolveColumns(next.columns);
      this.byId = new Map(this.resolved.map((c) => [c.id, c]));
    }
    const columnsChanged = merged.columns !== prev.columns;
    const pinningChanged = merged.columnPinning !== prev.columnPinning;
    const groupsChanged = merged.columnGroups !== prev.columnGroups;
    if (
      columnsChanged ||
      merged.columnSizing !== prev.columnSizing ||
      merged.autoWidths !== prev.autoWidths ||
      pinningChanged
    ) {
      this.#sizing = undefined;
    }
    if (
      columnsChanged ||
      groupsChanged ||
      merged.columnOrder !== prev.columnOrder ||
      pinningChanged
    ) {
      this.#order = undefined;
    }
    if (columnsChanged || groupsChanged) this.tree = this.#treeOf(merged.columnGroups);
    this.#views = undefined;
    this.#allViews = undefined;
    return reread;
  }

  #treeOf(groups: TableModelOptions<TData, TContent>['columnGroups']): GroupTree<TContent> {
    return resolveColumnGroups(groups, new Set(this.resolved.map((c) => c.id)));
  }

  /** The pin in effect: the state's, else the column's own. */
  #pinOf(
    column: ResolvedColumn<TData, TContent>,
    pinning = this.#options().columnPinning,
  ): ColumnPin | undefined {
    return pinIn(column, pinning);
  }

  /** The visibility in effect: the state's, else the column's own. */
  hiddenOf(
    column: ResolvedColumn<TData, TContent>,
    visibility = this.#options().columnVisibility,
  ): boolean {
    return hiddenIn(column, visibility);
  }

  /** Whether a column is shown. */
  readonly shown = (id: string): boolean => {
    const column = this.byId.get(id);
    return column !== undefined && !this.hiddenOf(column);
  };

  /** What ordering needs, with the pin in effect. */
  orderable() {
    return this.resolved.map((c) => ({
      id: c.id,
      pin: this.#pinOf(c),
      reorderable: c.reorderable,
    }));
  }

  orderState(): ColumnOrderState {
    return (this.#order ??= normalizeOrder(
      this.#options().columnOrder ?? [],
      this.orderable(),
      this.tree,
    ));
  }

  #sizingState(): ColumnSizingState {
    return (this.#sizing ??= sizingOf(this.#options(), this.resolved));
  }

  /** The shown columns' views, in order. A new array after every update. */
  views(): ColumnView<TData, TContent>[] {
    return (this.#views ??= buildViews(
      this.#options(),
      this.byId,
      this.orderState(),
      this.#sizingState(),
    ));
  }

  /** Every column's view, hidden ones too. */
  allViews(): ColumnView<TData, TContent>[] {
    return (this.#allViews ??= buildAllViews(
      this.#options(),
      this.byId,
      this.orderState(),
      this.#sizingState(),
      this.views(),
    ));
  }

  /** The group header rows over the shown columns, kept while what they read stays. */
  headerGroups(): HeaderGroupCell<TContent>[][] {
    const current = this.views();
    const tree = this.tree;
    const kept = this.#groupRows;
    if (kept?.views === current && kept.tree === tree) return kept.rows;
    const key = tree.groups.size ? headerGroupKey(current) : '';
    if (kept?.tree !== tree || kept.key !== key) {
      this.#groupRows = { views: current, tree, key, rows: headerGroupRows(tree, current) };
      return this.#groupRows.rows;
    }
    kept.views = current;
    return kept.rows;
  }
}
