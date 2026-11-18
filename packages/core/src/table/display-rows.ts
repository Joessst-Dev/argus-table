/** A row the body shows: a data row, or the detail panel under one (ADR 0011). */
export type DisplayRow = { kind: 'data'; index: number } | { kind: 'detail'; index: number };

/**
 * The rows the body shows, in order: every data row, and a panel row after each
 * open one. Positions count both; data indexes count data rows only (the current
 * order). Everything public uses data indexes; the body's layout, `aria-rowindex`
 * and keyboard moves use positions, and this maps between them.
 *
 * Lookups are binary searches over the open rows (k of them), O(log k); with none
 * open every method is the identity.
 */
export class DisplayRows {
  /** Data rows plus panels. */
  readonly count: number;
  readonly dataCount: number;
  /** The data indexes with a panel, sorted. */
  readonly open: readonly number[];

  /** `count` data rows; `open`: data indexes with a panel (any order; duplicates and indexes out of range are ignored). */
  constructor(count: number, open: Iterable<number> = []) {
    this.dataCount = count;
    const set = new Set<number>();
    for (const index of open) {
      if (Number.isInteger(index) && index >= 0 && index < count) set.add(index);
    }
    this.open = [...set].sort((a, b) => a - b);
    this.count = count + this.open.length;
  }

  /** The number of open rows with an index below `index`. */
  #openBefore(index: number): number {
    const open = this.open;
    let low = 0;
    let high = open.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((open[mid] ?? 0) < index) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  /** The row at a position, or `undefined` outside the body. */
  at(position: number): DisplayRow | undefined {
    if (!Number.isInteger(position) || position < 0 || position >= this.count) return undefined;
    // The panels at or above `position`: panel m (of open row open[m]) is at open[m] + m + 1.
    const open = this.open;
    let low = 0;
    let high = open.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((open[mid] ?? 0) + mid + 1 <= position) low = mid + 1;
      else high = mid;
    }
    const last = open[low - 1];
    if (last !== undefined && last + low === position) return { kind: 'detail', index: last };
    return { kind: 'data', index: position - low };
  }

  /** The position of a data row. */
  positionOf(index: number): number {
    return index + this.#openBefore(index);
  }

  /** The position of a data row's panel, or `undefined` when it has none. */
  detailPositionOf(index: number): number | undefined {
    return this.hasDetail(index) ? this.positionOf(index) + 1 : undefined;
  }

  hasDetail(index: number): boolean {
    return this.open[this.#openBefore(index)] === index;
  }

  /**
   * The data rows from position `start` to `end` (inclusive): the first and the last
   * data index among them, or `undefined` when there is none.
   */
  dataRange(start: number, end: number): { first: number; last: number } | undefined {
    const from = this.at(Math.max(0, start));
    const to = this.at(Math.min(end, this.count - 1));
    if (!from || !to) return undefined;
    // A panel at the start: the data row after it; at the end, its own row.
    const first = from.kind === 'detail' ? from.index + 1 : from.index;
    const last = to.index;
    return first <= last ? { first, last } : undefined;
  }
}
