import type { RowSizes } from './row-sizes.js';

/**
 * Engines place elements in a body taller than this (2^24 px) only to 2 px:
 * positions are 32-bit floats. Measured rows are whole px below it and an even
 * number of px above it, so every row starts on the grid and they stay flush.
 */
export const COARSE_BODY = 16_000_000;

/** The rows `MeasuredSizes` lays out. */
export interface MeasuredLayout {
  /** Rows, by position. */
  count: number;
  /** The least a row is, and what a row not measured yet counts as. */
  rowHeight: number;
  /** Changes identity whenever the row at a position may have changed. */
  order: object;
  /** The position of a row id in the current order. */
  indexOf: (id: string) => number | undefined;
  /** `true`: every row is measured (`rowHeight: 'auto'`); `false`: some (detail panels), off the px grid. */
  all: boolean;
  /** The tallest the body renders when it is `logical` px tall. */
  cap: (logical: number) => number;
}

/**
 * Measured row heights (`rowHeight: 'auto'`, detail panels), laid out in a
 * `RowSizes`. Heights are kept by row id as read, so they follow rows through a
 * sort or filter: a new `order` lays them out again at their new positions. A
 * row renders at least the row height, in whole px, or in even px once every row
 * is measured and the body renders past `COARSE_BODY`.
 */
export class MeasuredSizes {
  readonly #heights = new Map<string, number>();
  #layout: MeasuredLayout | undefined;
  /** The `order` the sizes are laid out for. */
  #order: object | undefined;
  /** Rows are whole multiples of this many px. */
  #quantum = 1;

  /**
   * Lays `sizes` out for `layout`: again for a new order or grid, resized for a
   * new count. A new row height, or a switch between measuring every row and
   * some, measures every row again.
   */
  layout(sizes: RowSizes, layout: MeasuredLayout): void {
    const prev = this.#layout;
    this.#layout = layout;
    if (prev?.all !== layout.all || prev.rowHeight !== layout.rowHeight) {
      // A new minimum height (density, a theme): every row measures again.
      this.#heights.clear();
      this.#order = undefined;
    }
    const reset = () => {
      sizes.reset(layout.count, this.#fit(0), this.#known(layout));
    };
    if (layout.order !== this.#order) {
      this.#order = layout.order;
      reset();
    } else if (layout.count !== sizes.count) {
      // A data source counting more rows: they keep their indexes.
      sizes.resize(layout.count);
    }
    // A body past 2^24 px needs even heights: fit the rows to the new grid.
    const rendered = Math.min(sizes.total, layout.cap(sizes.total));
    const quantum = layout.all && rendered > COARSE_BODY ? 2 : 1;
    if (quantum !== this.#quantum) {
      this.#quantum = quantum;
      reset();
    }
  }

  /**
   * Records the height read for the row `id` at position `index` (laid out by
   * `layout`). Returns whether the height it renders at changed.
   */
  set(sizes: RowSizes, index: number, id: string, px: number): boolean {
    this.#heights.set(id, px);
    return sizes.set(index, this.#fit(px)) !== 0;
  }

  /** Forgets every height: rows are the same height again. */
  clear(): void {
    this.#heights.clear();
    this.#layout = undefined;
    this.#order = undefined;
    this.#quantum = 1;
  }

  /** The measured heights by position in the current order. Forgets rows long gone. */
  *#known(layout: MeasuredLayout): Generator<[number, number]> {
    const heights = this.#heights;
    const prune = heights.size > 2 * layout.count + 1000;
    for (const [id, px] of heights) {
      const index = layout.indexOf(id);
      if (index !== undefined && index < layout.count) yield [index, this.#fit(px)];
      else if (prune) heights.delete(id);
    }
  }

  /** A measured height as a row renders it: on the grid, at least the row height. */
  #fit(px: number): number {
    const q = this.#quantum;
    const up = (value: number) => Math.ceil(value / q - 0.01) * q;
    return Math.max(up(px), up(this.#layout?.rowHeight ?? 0));
  }
}
