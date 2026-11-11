import type { ColumnAlign, ColumnDef, ColumnPin, FilterKind } from '../types.js';

/** Width used when a column sets none. */
export const DEFAULT_WIDTH = 150;
/** Lower bound used when a column sets no `minWidth`. */
export const DEFAULT_MIN_WIDTH = 40;

/** A column after defaults, bounds and the accessor have been resolved. */
export interface ResolvedColumn<TData, TContent> {
  id: string;
  header: ColumnDef<TData, TContent>['header'];
  cell: ColumnDef<TData, TContent>['cell'];
  /** Reads the cell value; returns `undefined` when the column has no accessor. */
  getValue: (row: TData, index: number) => unknown;
  hasAccessor: boolean;
  /** Base width in px. For a flex column this is its minimum track size. */
  width: number;
  /**
   * Share of free space for `{ flex }` columns, otherwise `undefined`. Kept for pinned
   * columns too: the model drops it while the column is pinned (see `pinnedWidth`).
   */
  flex: number | undefined;
  /**
   * Width in px while the column is pinned. Pinned columns need a known width for their
   * sticky offsets, so a flex column pinned (by its definition or by state) gets the
   * default width, within its bounds. Equal to `width` for every other column.
   */
  pinnedWidth: number;
  /** `true` for `width: 'auto'`: the table measures the content and passes the width in. */
  auto: boolean;
  minWidth: number;
  maxWidth: number;
  /** The pin of the definition; `columnPinning` state can override it. */
  pin: ColumnPin | undefined;
  /** Hidden by the definition; `columnVisibility` state can override it. */
  hidden: boolean;
  sortable: boolean;
  resizable: boolean;
  reorderable: boolean;
  pinnable: boolean;
  hideable: boolean;
  /** The kind of filter users can set, or `undefined` when they can't filter the column. */
  filter: FilterKind | undefined;
  filterFn: ColumnDef<TData, TContent>['filterFn'];
  filterOptions: ColumnDef<TData, TContent>['filterOptions'];
  align: ColumnAlign;
  wrap: boolean;
}

const FILTER_KINDS: readonly unknown[] = ['text', 'number', 'date', 'set'] satisfies FilterKind[];

const pathCache = new Map<string, readonly string[]>();

/**
 * Reads a dotted property path such as `'customer.name'`. Returns `undefined`
 * as soon as a step is `null` or `undefined`, like optional chaining.
 */
export function readPath(source: unknown, path: string): unknown {
  let keys = pathCache.get(path);
  if (!keys) {
    keys = path.split('.');
    pathCache.set(path, keys);
  }
  let value: unknown = source;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function finite(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

/**
 * Normalizes `ColumnDef`s: checks ids, applies defaults and clamps widths.
 *
 * @throws if an id is empty or used twice, because state and events are keyed by id.
 */
export function resolveColumns<TData, TContent>(
  defs: readonly ColumnDef<TData, TContent>[],
): ResolvedColumn<TData, TContent>[] {
  const seen = new Set<string>();
  return defs.map((def, index) => {
    if (typeof def.id !== 'string' || def.id === '') {
      throw new Error(`argus-table: column at index ${String(index)} needs a non-empty string id.`);
    }
    if (seen.has(def.id)) {
      throw new Error(`argus-table: column id '${def.id}' is used more than once.`);
    }
    seen.add(def.id);

    const minWidth = Math.max(0, finite(def.minWidth) ?? DEFAULT_MIN_WIDTH);
    const maxWidth = Math.max(minWidth, finite(def.maxWidth) ?? Number.POSITIVE_INFINITY);
    const clamp = (px: number) => Math.min(maxWidth, Math.max(minWidth, px));

    const pin = def.pin === 'start' || def.pin === 'end' ? def.pin : undefined;
    const { width } = def;
    const flex =
      typeof width === 'object' && Number.isFinite(width.flex) && width.flex > 0
        ? width.flex
        : undefined;
    const auto = width === 'auto';
    // An auto column shows the default width until it is measured.
    const fixed = typeof width === 'number' ? finite(width) : undefined;
    const pinnedWidth = clamp(fixed ?? DEFAULT_WIDTH);
    const base = flex !== undefined ? minWidth : pinnedWidth;

    const { accessor } = def;
    const getValue: ResolvedColumn<TData, TContent>['getValue'] =
      typeof accessor === 'function'
        ? accessor
        : typeof accessor === 'string'
          ? (row) => readPath(row, accessor)
          : () => undefined;

    return {
      id: def.id,
      header: def.header,
      cell: def.cell,
      getValue,
      hasAccessor: accessor !== undefined,
      width: base,
      flex,
      pinnedWidth,
      auto,
      minWidth,
      maxWidth,
      pin,
      hidden: def.hidden === true,
      sortable: def.sortable === true,
      resizable: def.resizable !== false,
      reorderable: def.reorderable !== false,
      pinnable: def.pinnable !== false,
      hideable: def.hideable !== false,
      filter: FILTER_KINDS.includes(def.filter) ? def.filter : undefined,
      filterFn: def.filterFn,
      filterOptions: def.filterOptions,
      align: def.align ?? 'start',
      wrap: def.wrap === true,
    };
  });
}
