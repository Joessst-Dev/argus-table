import type { ResolvedColumn } from '../columns/resolve-columns.js';
import type { RowPredicate } from '../filters/filter.js';
import { DisplayRows } from './display-rows.js';
import type { TableModelOptions } from './model-types.js';
import { sortRows } from './sorted-row-model.js';
import type { SortState } from '../types.js';

/**
 * The body's rows: indexes into `data`, no object per row (ADR 0010). All rows,
 * the ones the filters keep, those in the sort order, and the displayed rows
 * (data rows and open detail panels). Each step keeps its array while what it
 * reads is the same, so `rows()` keeps its identity. Remote rows aren't here:
 * the model reads them from `options.remote`.
 */
export class RowPipeline<TData, TContent> {
  readonly #options: () => TableModelOptions<TData, TContent>;
  readonly #byId: () => ReadonlyMap<string, ResolvedColumn<TData, TContent>>;
  /** The row test of the filters and the quick filter; `undefined` when nothing filters. */
  readonly #predicate: () => RowPredicate<TData> | undefined;
  /** Bumped when a column reads its values differently: filter and sort again. */
  readonly #version: () => number;

  // A new `getRowId` gives a new array too: the ids at each index changed.
  #all: { data: readonly TData[]; getRowId: unknown; rows: number[] } | undefined;
  #filtered:
    | { source: readonly number[]; test: unknown; version: number; rows: readonly number[] }
    | undefined;
  #sorted:
    | { source: readonly number[]; sorting: SortState; version: number; rows: readonly number[] }
    | undefined;
  // Built lazily per row order (a sort, a filter or new data gives a new array).
  #indexById: { rows: readonly number[]; map: Map<string, number> } | undefined;
  #display: { key: readonly unknown[] | undefined; rows: DisplayRows } | undefined;

  constructor(
    options: () => TableModelOptions<TData, TContent>,
    byId: () => ReadonlyMap<string, ResolvedColumn<TData, TContent>>,
    predicate: () => RowPredicate<TData> | undefined,
    version: () => number,
  ) {
    this.#options = options;
    this.#byId = byId;
    this.#predicate = predicate;
    this.#version = version;
  }

  #allRows(): readonly number[] {
    const { data, getRowId } = this.#options();
    const all = this.#all;
    if (all?.data !== data || all.getRowId !== getRowId) {
      const rows = new Array<number>(data.length);
      for (let i = 0; i < rows.length; i++) rows[i] = i;
      this.#all = { data, getRowId, rows };
      return rows;
    }
    return all.rows;
  }

  #filteredRows(): readonly number[] {
    const source = this.#allRows();
    const test = this.#predicate();
    if (!test) return source;
    const version = this.#version();
    const prev = this.#filtered;
    if (prev?.source === source && prev.test === test && prev.version === version) {
      return prev.rows;
    }
    const { data } = this.#options();
    const rows = source.filter((i) => test(data[i] as TData, i));
    this.#filtered = { source, test, version, rows };
    return rows;
  }

  /** The body rows in the current order (data indexes); `[]` with remote rows. */
  rows(): readonly number[] {
    const options = this.#options();
    if (options.remote) return [];
    const source = this.#filteredRows();
    const { sorting } = options;
    const version = this.#version();
    const prev = this.#sorted;
    if (prev?.source === source && prev.sorting === sorting && prev.version === version) {
      return prev.rows;
    }
    const byId = this.#byId();
    const result = sortRows(options.data, source, sorting, (id) => byId.get(id));
    this.#sorted = { source, sorting, version, rows: result };
    return result;
  }

  /** The id of the row at a data index. */
  rowId(dataIndex: number): string {
    const options = this.#options();
    return options.getRowId
      ? options.getRowId(options.data[dataIndex] as TData, dataIndex)
      : String(dataIndex);
  }

  /** The row object at an index of the current order; `undefined` for a remote row not loaded. */
  rowAt(index: number): TData | undefined {
    const options = this.#options();
    if (options.remote) return options.remote.entryAt(index)?.row;
    const row = this.rows()[index];
    return row === undefined ? undefined : options.data[row];
  }

  /** The index in the current order of a row id. */
  indexOf(rowId: string): number | undefined {
    const { remote } = this.#options();
    if (remote) return remote.indexOf(rowId);
    const current = this.rows();
    if (this.#indexById?.rows !== current) {
      this.#indexById = {
        rows: current,
        map: new Map(current.map((r, i) => [this.rowId(r), i])),
      };
    }
    return this.#indexById.map.get(rowId);
  }

  /** Whether the row at an index of the current order can open a detail panel. */
  expandable(index: number): boolean {
    const options = this.#options();
    if (!options.detail) return false;
    const row = this.rowAt(index);
    return row !== undefined && (options.rowExpandable?.(row) ?? true);
  }

  /**
   * The displayed rows, kept while what they read is the same: with remote rows,
   * their `version` (rows load without a new order). A remote without one is built
   * again on each read, keeping the previous object when nothing differs.
   */
  display(): DisplayRows {
    const options = this.#options();
    const { remote } = options;
    const count = remote?.rowCount ?? this.rows().length;
    const key = remote
      ? remote.version === undefined
        ? undefined
        : [remote, remote.version, options.expanded, options.rowExpandable, options.detail]
      : [this.rows(), options.expanded, options.rowExpandable, options.detail];
    const prev = this.#display;
    if (key && prev?.key?.every((part, i) => part === key[i])) return prev.rows;
    const open: number[] = [];
    if (options.detail) {
      for (const id of options.expanded ?? []) {
        const index = this.indexOf(id);
        if (index !== undefined && this.expandable(index)) open.push(index);
      }
    }
    const next = new DisplayRows(count, open);
    const same =
      prev?.rows.count === next.count &&
      prev.rows.dataCount === next.dataCount &&
      prev.rows.open.every((index, i) => index === next.open[i]);
    this.#display = { key, rows: same ? prev.rows : next };
    return this.#display.rows;
  }
}
