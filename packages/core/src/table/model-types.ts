import type { HeaderGroupCell } from '../columns/column-groups.js';
import type { OrderUnit, SiblingUnit } from '../columns/column-order.js';
import type { TreeForest } from './tree-order.js';
import type { RowState } from '../data/page-cache.js';
import type { RowStructure } from './row-structure.js';
import type {
  CellContext,
  GroupingState,
  GroupRowInfo,
  ColumnAlign,
  ColumnDef,
  ColumnGroup,
  ColumnFilter,
  ColumnFilterState,
  ColumnOrderState,
  ColumnPin,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  ExpandedState,
  FilterKind,
  FilterValue,
  PinnedRows,
  RowPin,
  SelectionState,
  SortState,
  TreeExpandedState,
} from '../types.js';
import type { BranchCheck, BranchTree } from '../state/selection.js';
import type { DisplayRows } from './display-rows.js';

/** Sort direction of a column, or `false` when it isn't sorted. */
export type SortDirection = 'asc' | 'desc' | false;

/**
 * Id of the selection column, the checkbox column the model adds first when
 * `selectionColumn` is set. Not a column of `columns`: it never appears in the
 * column order, sizing or events.
 */
export const SELECTION_COLUMN_ID = '--argus-selection';

/** Width of the selection column in px. */
export const SELECTION_COLUMN_WIDTH = 40;

/**
 * Id of the toggle column, the column of chevrons that open rows' detail panels,
 * which the model adds after the selection column when `detail` is set. Not a
 * column of `columns`, like the selection column.
 */
export const EXPAND_COLUMN_ID = '--argus-expand';

/** Width of the toggle column in px. */
export const EXPAND_COLUMN_WIDTH = 40;

/** A column as the renderer sees it, in visual order: start-pinned, scrolling, end-pinned. */
export interface ColumnView<TData, TContent> {
  id: string;
  /**
   * `'data'` for a column of `columns`; `'selection'` for the checkbox column,
   * `'expand'` for the toggle column of detail panels.
   */
  kind: 'data' | 'selection' | 'expand';
  /** 1-based position in visual order, for `aria-colindex`. `0` for a hidden column. */
  colIndex: number;
  /** The pin in effect: `columnPinning`'s, else the column's own. */
  pin: ColumnPin | undefined;
  /**
   * Sticky inset in px: from the start edge for `'start'` columns, from the end edge
   * for `'end'` columns. For scrolling columns, the start within the scrolling area.
   */
  offset: number;
  /** `true` on the pinned column next to the scrolling area (one per pinned side). */
  pinEdge: boolean;
  /**
   * `true` for a hidden column. Only `allColumns` lists hidden columns; `columns`
   * holds the ones the table shows.
   */
  hidden: boolean;
  /**
   * Width in px as rendered: the own width, plus a share of the free space when
   * the table stretches its columns (`stretch`).
   */
  width: number;
  /** The column's own width in px (a resized width wins over its definition's), unstretched. */
  ownWidth: number;
  /** Share of free space, or `undefined` for a fixed width. A resized column stops flexing. */
  flex: number | undefined;
  /**
   * `true` for a `width: 'auto'` column that hasn't been resized: the table measures
   * its content and passes the width in as `autoWidths`.
   */
  auto: boolean;
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
  resizable: boolean;
  reorderable: boolean;
  pinnable: boolean;
  hideable: boolean;
  /** Whether the rows can be grouped by the column (`ColumnDef.groupable`). */
  groupable: boolean;
  /** The kind of filter users can set, or `undefined` when they can't filter the column. */
  filter: FilterKind | undefined;
  /** `true` when `columnFilters` has a filter for the column. */
  filtered: boolean;
  align: ColumnAlign;
  /** Whether the cell text wraps (`ColumnDef.wrap`). */
  wrap: boolean;
  sorted: SortDirection;
  header: ColumnDef<TData, TContent>['header'];
  cell: ColumnDef<TData, TContent>['cell'];
  /** A group row's cell content (`ColumnDef.groupCell`). */
  groupCell: ColumnDef<TData, TContent>['groupCell'];
  /** The definition's `meta`, for plugins. */
  meta: ColumnDef<TData, TContent>['meta'];
  hasAccessor: boolean;
}

/** A row of the current (filtered and sorted) row model. */
export interface RowView<TData> {
  id: string;
  /** Index in the current row model, 0-based. */
  index: number;
  original: TData;
}

/** Where a row of the current order sits in a tree of rows (`TableModel.treeRow`). */
export interface TreeRowInfo {
  /** `0` for a top-level row, `1` for its children, and so on. */
  depth: number;
  /** Has children the filters keep. */
  hasChildren: boolean;
  /**
   * What shows: open when it has children and its id is in `treeExpanded`, or
   * holds a match while a filter is on (shown open whatever `treeExpanded`
   * says). Always `false` without children.
   */
  open: boolean;
  /**
   * Shown open because a filter keeps a match under it (whatever `treeExpanded`
   * says): its toggle can't change that until the filter clears. Always `false`
   * without a filter or without children.
   */
  forced: boolean;
  /** The parent's index in the current order; `undefined` for a top-level row. */
  parent: number | undefined;
  /** The number of its siblings the filters keep, itself included. */
  setSize: number;
  /** Its position among those siblings, 1-based. */
  posInSet: number;
}

/**
 * Rows that live outside the model, loaded page by page (`dataSource`). The
 * source sorts them, so the model reads them as they are. `PageCache` implements it.
 */
export interface RemoteRows<TData> {
  readonly rowCount: number;
  /** The loaded row at an index, with its id; `undefined` while it isn't loaded. */
  entryAt(index: number): { id: string; row: TData } | undefined;
  /** The index of a loaded row's id, or `undefined`. */
  indexOf(rowId: string): number | undefined;
  /** The ids of every loaded row, in row order. */
  loadedIds(): string[];
  /**
   * Changes whenever the loaded rows or the row count change, so what the model
   * builds from them can be kept until then. Without it, it's built on each read.
   */
  readonly version?: number;
  /**
   * For rows that form a tree (`RemoteTree`): changes identity when loaded rows
   * change position (a row expanded or collapsed, children loaded or failed), not
   * when only a page loads. The model's `rowOrder` is then this object.
   */
  readonly order?: object;
  /** The state of the row at an index (`PageCache.stateAt`); without it, rows count as loaded. */
  stateAt?(index: number): RowState;
  /**
   * For rows the remote arranges itself (a data source's tree, `RemoteTree`):
   * their structure. The model reads the rows as a tree when it says so;
   * without it, they're flat (the model's `ModelRows`).
   */
  readonly structure?: RowStructure;
}

/**
 * A remote tree's loaded rows (top-level rows and loaded children, collapsed
 * or not) for branch selection: every row is kept, and a row whose children
 * aren't loaded is a leaf.
 */
export interface RemoteForest extends TreeForest {
  /** The forest row of the loaded row at a shown index; `undefined` for rows not loaded. */
  readonly at: (index: number) => number | undefined;
}

export interface TableModelOptions<TData, TContent> {
  columns: readonly ColumnDef<TData, TContent>[];
  /**
   * Headers over several columns, nested to any depth. Their columns stay next to
   * each other in the order, and each level adds a header row.
   */
  columnGroups?: readonly ColumnGroup<TContent>[] | undefined;
  data: readonly TData[];
  /**
   * Remote rows. When set, rows come from here instead of `data`, and the model
   * doesn't sort them (the source does).
   */
  remote?: RemoteRows<TData> | undefined;
  /**
   * Row id function, given each row with its source index (see `getSubRows`).
   * Default: the row's index in `data`, as a string; for a nested child, its
   * parent's id, a dot and its index among its siblings (`'3.0.2'`).
   */
  getRowId: ((row: TData, index: number) => string) | undefined;
  /**
   * Nested data: a row's children. `data` holds the top-level rows, and the rows
   * form a tree. Rows are then known by their source index: a top-level row's
   * index in `data`, and from `data.length` on, the nested children in
   * depth-first order. Wins over `getParentId`. Ignored with `remote`.
   */
  getSubRows?: ((row: TData) => readonly TData[] | undefined) | undefined;
  /**
   * Flat data: the id of a row's parent (an id `getRowId` gives), or `null` or
   * `undefined` for a top-level row. `data` holds every row, and the rows form a
   * tree. Ignored with `remote`.
   */
  getParentId?: ((row: TData) => string | null | undefined) | undefined;
  /**
   * The ids of the tree's expanded rows: the children of the others aren't in the
   * current order. While a filter is on, rows holding a match are shown open too.
   * Its owner is the caller. A remote tree is given them by its owner
   * (`RemoteTree.setExpanded`): the model reads them only in `nextTreeExpanded`.
   */
  treeExpanded?: TreeExpandedState | undefined;
  /**
   * The columns to group `data`'s rows by, outermost first: group rows, opened
   * through `treeExpanded`, with the rows under them. Ids of columns that
   * aren't `groupable` are ignored; all of it with tree rows or `remote`.
   */
  grouping?: GroupingState | undefined;
  /** Current sort state; its owner is the caller (see `controllable`). */
  sorting: SortState;
  /** Current resized widths; its owner is the caller. */
  columnSizing: ColumnSizingState;
  /**
   * Current column order; its owner is the caller. Each pin group follows it; an
   * empty array (the default) keeps the order of `columns`.
   */
  columnOrder?: ColumnOrderState | undefined;
  /** Pins set at runtime, over the columns' own `pin`; its owner is the caller. */
  columnPinning?: ColumnPinningState | undefined;
  /** Visibility set at runtime, over the columns' own `hidden`; its owner is the caller. */
  columnVisibility?: ColumnVisibilityState | undefined;
  /**
   * Column filters; its owner is the caller. Rows that fail one leave the row model.
   * Remote rows aren't filtered: the source does it.
   */
  columnFilters?: ColumnFilterState | undefined;
  /**
   * Words to find in the shown columns' values as text, ignoring case: a row stays
   * when each word is in one of its values. Remote rows aren't filtered.
   */
  quickFilter?: string | undefined;
  /**
   * Measured widths of `width: 'auto'` columns, in px by id. Clamped to the column's
   * bounds; a resized width wins. Ids of other columns are ignored.
   */
  autoWidths?: ColumnSizingState | undefined;
  /** Rows fixed above or below the body. They stay out of the row model: never sorted, not counted. */
  pinnedRows?: PinnedRows<TData> | undefined;
  /**
   * Adds the selection (checkbox) column first among the start-pinned columns. It
   * has the id `SELECTION_COLUMN_ID`, a fixed width, and no part in sorting,
   * sizing or the column order.
   */
  selectionColumn?: boolean | undefined;
  /**
   * Rows can open a detail panel (the table's `rowDetail` is set): adds the toggle
   * column (`EXPAND_COLUMN_ID`) after the selection column, and a panel row after
   * each expanded row in `display`.
   */
  detail?: boolean | undefined;
  /** The ids of the rows whose panel is open; its owner is the caller. */
  expanded?: ExpandedState | undefined;
  /** Rows that can open a panel; default: every row. */
  rowExpandable?: ((row: TData) => boolean) | undefined;
  /**
   * Stretches the scrolling columns to fill `width` px (the table's inner width)
   * when they are narrower: the columns without a `columnSizing` entry share the
   * space in proportion to their own widths, up to their `maxWidth`; what they
   * can't take goes to the last scrolling columns that can, except those in
   * `keep` (the columns the last resize changed). Nothing stretches while an
   * unresized flex column is shown.
   */
  stretch?: { width: number; keep?: readonly string[] | undefined } | undefined;
}

export interface TableModel<TData, TContent> {
  /** Updates any subset of the options. Unchanged references are ignored. */
  update(options: Partial<TableModelOptions<TData, TContent>>): void;
  /** The columns the table shows, in visual order. */
  readonly columns: readonly ColumnView<TData, TContent>[];
  /**
   * Every column of `columns`, hidden ones included (with `hidden: true` and
   * `colIndex: 0`), in the order of `orderOf()`. Not the selection column.
   */
  readonly allColumns: readonly ColumnView<TData, TContent>[];
  /** Number of rows in the current row model. */
  readonly rowCount: number;
  /**
   * Changes identity whenever the row at an index may have changed: new data, a
   * sort, a filter, a new remote source. Compare it by identity only. For remote
   * rows: the remote's `order` when it has one (a remote tree: a new object when
   * loaded rows move, as when a row opens, closes or its children load; not when
   * a page loads), else the remote itself.
   */
  readonly rowOrder: object;
  /** Sum of the shown columns' widths in px (flex columns count their minimum). */
  readonly totalWidth: number;
  /**
   * The group header rows over `columns`, top row first; empty without column groups.
   * Keeps its identity while `columns` does.
   */
  readonly headerGroups: readonly (readonly HeaderGroupCell<TContent>[])[];
  /** Number of header rows: the group rows and the row of column headers. */
  readonly headerRows: number;
  /** The cell of group header row `level` over a column, or `undefined`. */
  headerCell(level: number, columnId: string): HeaderGroupCell<TContent> | undefined;
  /**
   * The rows the body shows: every row of the current row model, and a panel row
   * after each expanded row that can show one (loaded, allowed by `rowExpandable`).
   * The identity without `detail`. Keeps its identity while the row order,
   * `expanded`, `rowExpandable` and `detail` stay the same (for remote rows, also
   * while no more rows have loaded).
   */
  readonly display: DisplayRows;
  /** Whether the row at a data index can open a panel: `detail` is set, it's loaded and `rowExpandable` allows it. */
  expandable(index: number): boolean;
  /**
   * The expanded ids after opening or closing a row's panel, starting from `base`
   * (default: the current `expanded`). `undefined` when nothing changes or the row
   * can't expand (unknown, not loaded, refused by `rowExpandable`, no `detail`).
   */
  nextExpanded(rowId: string, open: boolean, base?: ExpandedState): ExpandedState | undefined;
  /** The row at an index of the current row model; `undefined` for a remote row not loaded yet. */
  rowAt(index: number): RowView<TData> | undefined;
  /**
   * Whether the rows form a tree: `getSubRows` or `getParentId` is set and the
   * rows aren't remote, or the remote rows form one (their `structure` says so, as a
   * `RemoteTree` does). The current order then holds the rows shown: children of
   * collapsed rows are out of it, like rows the filters drop; for a remote tree,
   * the top-level rows and the loaded (or loading) children of open rows.
   */
  readonly tree: boolean;
  /**
   * Where the row at an index of the current order sits in the tree; `undefined`
   * without a tree. For a remote tree, the remote's answer: `undefined` for a row
   * not loaded and for a placeholder of children loading or failed, `forced`
   * always `false`.
   */
  treeRow(index: number): TreeRowInfo | undefined;
  /**
   * `treeExpanded` after expanding or collapsing a row, starting from `base`
   * (default: the current `treeExpanded`). `undefined` without a tree, for an
   * unknown row or one without children (filters not applied), or no change.
   * For a remote tree, a row opens when the remote's `canExpand` allows it
   * (loaded, `hasChildren`, children not known to be none); an id in `base`
   * closes whether or not its row is loaded.
   */
  nextTreeExpanded(
    rowId: string,
    open: boolean,
    base?: TreeExpandedState,
  ): TreeExpandedState | undefined;
  /**
   * The index in the current order of the row itself when it's shown, else of its
   * nearest shown ancestor (for a row under a collapsed row or filtered out).
   * `undefined` without a tree, for an unknown id, or when no ancestor is shown.
   * For a remote tree, the remote's answer (rows it has loaded).
   */
  shownAncestor(rowId: string): number | undefined;
  /**
   * How the shown rows are arranged (`RowStructure`): row states, ids that hold
   * a row's place before it loads, parents and depths, the tree toggle's id.
   * Read rows' arrangement here rather than from where they come from.
   */
  readonly rows: RowStructure;
  /**
   * The row object at a source index: `data[index]` without a tree or with flat
   * data, and nested children from `data.length` on (see `getSubRows`).
   * `undefined` with remote rows.
   */
  sourceRow(index: number): TData | undefined;
  /**
   * While grouped: every group row and every row the filters keep, in the
   * grouped order with every group open (what an export of the grouped rows
   * lists): its source index, id and depth, and a group row's info. `undefined`
   * without grouping.
   */
  groupedOrder():
    | readonly { index: number; id: string; depth: number; group: GroupRowInfo | undefined }[]
    | undefined;
  /** The index of a row id in the current row model (after filtering and sorting), or `undefined`. */
  indexOf(rowId: string): number | undefined;
  /**
   * The ids of the rows that can be selected, in row order: every row of the row
   * model, or only the loaded ones for remote rows.
   */
  selectableIds(): string[];
  /**
   * Select-all with branches: `current` plus every row the filters keep
   * (collapsed ones included, depth-first), where a parent's id is added only
   * when its whole branch ends up selected, filters not applied; kept parents
   * selected against that rule lose their ids. What `withBranches` gives for
   * every kept row, in one pass over typed arrays. `selected` is `current` as a
   * set (made here when not given). `current` as it is without a tree. For a
   * remote tree, its loaded rows (`RemoteTree.forest()`): top-level rows and
   * loaded children, collapsed or not.
   */
  branchSelectAll(current: readonly string[], selected?: ReadonlySet<string>): SelectionState;
  /**
   * The rows the filters keep as a tree of ids (collapsed rows don't matter),
   * with each row's children in the whole tree, for `withBranches` and
   * `toggleBranch`; `undefined` without a tree. Kept per filter and sort
   * result. For a remote tree, its loaded rows (a row whose children aren't
   * loaded is a leaf), kept per version; `children` is `allChildren` there,
   * since the server filters.
   */
  branchTree(): BranchTree | undefined;
  /**
   * Each row's checkbox state for a selection, by index in the current order:
   * `'all'` when its id and every kept descendant (under collapsed rows too)
   * are selected, `'some'` when any of them is; `'blocked'` when ticking it
   * could select nothing (its id kept out by descendants left unselected, none
   * of its kept descendants tickable), and blocked rows don't count as
   * unselected rows of their ancestors' branches. A selection that breaks the
   * branch rules (a parent without all its children) shows as it is. One pass
   * per selection `Set` and filter and sort result (for a remote tree, its
   * loaded rows; under a server filter a row without loaded children is
   * blocked). Needs a tree: without one every row is `'none'`.
   */
  branchCheck(selected: ReadonlySet<string>): (index: number) => BranchCheck;
  /**
   * The select-all checkbox with branches, for a selection: `'all'` when every
   * row the filters keep that isn't blocked counts as checked (as
   * `toggleBranch` decides), `'some'` when any of them is selected, else
   * `'none'`; `'blocked'` when every row the filters keep is blocked (or there
   * are none), so select-all could select nothing. Worked out and kept with
   * `branchCheck`.
   */
  branchCheckAll(selected: ReadonlySet<string>): BranchCheck;
  /** The value a column reads from the row at `index`. */
  valueAt(index: number, columnId: string): unknown;
  /** The value a column reads from any row object, as its accessor gets it at `index`. */
  readValue(row: TData, columnId: string, index: number): unknown;
  /**
   * What a column's `cell` function receives for the row at `index`; with
   * `depth` when the rows form a tree (a remote tree included).
   */
  cellContext(index: number, columnId: string): CellContext<TData> | undefined;
  /**
   * The sort state that clicking this column's header would produce:
   * asc → desc → unsorted, one column at a time. `undefined` if it can't sort.
   */
  nextSorting(columnId: string): SortState | undefined;
  /**
   * The sizing state after setting a column to `width` px, clamped to its bounds.
   * `undefined` if the column can't be resized.
   */
  nextSizing(columnId: string, width: number): ColumnSizingState | undefined;
  /**
   * The full column order as the table shows it: start-pinned, scrolling and
   * end-pinned ids. `base` defaults to the current `columnOrder`.
   */
  orderOf(base?: readonly string[]): ColumnOrderState;
  /**
   * The units a column or group moves among: the shown columns and groups with the
   * same parent group on the same pin side, in visual order, starting from `base`
   * (default: the current order). Empty if the unit isn't shown.
   */
  siblingUnits(unit: OrderUnit, base?: readonly string[]): SiblingUnit[];
  /**
   * The order after moving a column or group to position `to` among its sibling
   * units (0-based, counted after the move; hidden columns keep their place),
   * starting from `base` (default: the current order). `undefined` if it can't
   * move or is hidden, `to` is out of range, or nothing changes.
   */
  nextMove(unit: OrderUnit, to: number, base?: readonly string[]): ColumnOrderState | undefined;
  /**
   * The pinning state after pinning a column to a side, or unpinning it with `false`,
   * starting from `base` (default: the current `columnPinning`). `undefined` for an
   * unknown column, one with `pinnable: false`, or no change.
   */
  nextPinning(
    columnId: string,
    pin: ColumnPin | false,
    base?: ColumnPinningState,
  ): ColumnPinningState | undefined;
  /**
   * The visibility state after hiding or showing a column, starting from `base`
   * (default: the current `columnVisibility`). `undefined` for an unknown column,
   * hiding one with `hideable: false` or the last one shown, or no change.
   */
  nextVisibility(
    columnId: string,
    hidden: boolean,
    base?: ColumnVisibilityState,
  ): ColumnVisibilityState | undefined;
  /**
   * The filter state after setting a column's filter, or clearing it with `undefined`,
   * starting from `base` (default: the current `columnFilters`). `undefined` for an
   * unknown column, setting a filter on a column without `filter`, or no change.
   */
  nextFilters(
    columnId: string,
    filter: ColumnFilter | undefined,
    base?: ColumnFilterState,
  ): ColumnFilterState | undefined;
  /**
   * The values a `'set'` filter on the column offers: its `filterOptions`, else (not for
   * remote rows) the distinct values of the rows the other filters keep, sorted, at most
   * `limit` of them (`truncated` when there are more). `undefined` for an unknown column,
   * or remote rows without `filterOptions`.
   */
  filterValues(
    columnId: string,
    limit?: number,
  ): { values: FilterValue[]; truncated: boolean } | undefined;
  /**
   * The source indexes (see `getSubRows`; indexes in `data` without nested rows) of
   * the rows the column filters and the quick filter keep, with the ancestors of
   * those in a tree (rows under collapsed rows included), ascending (not sorted),
   * leaving out the filters on the `except` columns and their
   * text in the quick filter. `undefined` for remote rows. Reads only the core rows
   * and the other columns' accessors, so an accessor of an `except` column can call it
   * while the model filters or sorts.
   */
  indexesPassing(except?: Iterable<string>): readonly number[] | undefined;
  /** Number of rows pinned to a side. */
  pinnedCount(side: RowPin): number;
  /**
   * A pinned row, `index` counted within its side. Its id comes from `getRowId`,
   * else it is `'top-{index}'` or `'bottom-{index}'`, apart from the data rows' index ids.
   */
  pinnedRowAt(side: RowPin, index: number): RowView<TData> | undefined;
  /** The value a column reads from a pinned row. */
  pinnedValueAt(side: RowPin, index: number, columnId: string): unknown;
  /** What a column's `cell` function receives for a pinned row (with `pinned` set). */
  pinnedCellContext(side: RowPin, index: number, columnId: string): CellContext<TData> | undefined;
}
