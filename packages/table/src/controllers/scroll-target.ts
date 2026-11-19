import type { ReactiveElement } from 'lit';
import { alignOffset, type RowLayout, type TableModel } from '@argus-table/core';
import { directionOf, layoutOf, pinnedWidth, positionOfIndex } from '../grid.js';
import type {
  CellContent,
  RowTarget,
  ScrollAlign,
  ScrollState,
  ScrollToColumnOptions,
  ScrollToRowOptions,
} from '../types.js';
import type { DataController } from './data-controller.js';
import type { VirtualController } from './virtual-controller.js';

/**
 * Scrolling to a row or a column (`scrollToRow()`, `scrollToColumn()`,
 * `setState()`'s `scroll`), and the row still to reach: a data source's rows
 * that far aren't counted yet, so it's scrolled to again whenever the row
 * count changes, until the user scrolls, clicks or presses a key.
 */
export class ScrollTarget<T> {
  readonly #host: ReactiveElement;
  readonly #model: () => TableModel<T, CellContent>;
  readonly #virtual: VirtualController;
  readonly #data: DataController<T>;
  /** The rows in the scroller above the body (header, top pinned rows) and below it, in px. */
  readonly #insets: (layout: RowLayout) => { before: number; after: number };
  /** Rows of different heights are measured: they settle over a few updates. */
  readonly #measuring: () => boolean;
  readonly #scroller: () => HTMLElement | null;
  #target: { row: number; count: number; align: ScrollAlign } | undefined;
  /** The column `scrollToColumn()` renders with `virtualizeColumns`. */
  keep: string | undefined;

  constructor(
    host: ReactiveElement,
    model: () => TableModel<T, CellContent>,
    virtual: VirtualController,
    data: DataController<T>,
    insets: (layout: RowLayout) => { before: number; after: number },
    measuring: () => boolean,
    scroller: () => HTMLElement | null,
  ) {
    this.#host = host;
    this.#model = model;
    this.#virtual = virtual;
    this.#data = data;
    this.#insets = insets;
    this.#measuring = measuring;
    this.#scroller = scroller;
    // The user's own scrolling (or a click, or a key) wins over a restored position.
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
      host.addEventListener(type, this.drop, { passive: true });
    }
  }

  /** Forgets the row still to reach: other rows, or the user took over. */
  readonly drop = () => {
    this.#target = undefined;
  };

  /** `scrollToRow()`: see its documentation on the element. */
  async toRow(target: RowTarget, options: ScrollToRowOptions): Promise<boolean> {
    await this.#host.updateComplete;
    const model = this.#model();
    const index = typeof target === 'number' ? target : model.indexOf(target.id);
    if (index === undefined || !Number.isInteger(index) || index < 0) return false;
    const align = options.align ?? 'start';
    const count = model.rowCount;
    this.#target =
      this.#data.cache?.totalKnown === false && index >= count
        ? { row: index, count, align }
        : undefined;
    this.#scrollRowTo(index, align);
    // The scroll event comes before the next frame, and the rows move with its
    // update. Rows measured on the way (`rowHeight: 'auto'`) move a row that
    // isn't at the top: align it again until they're done.
    for (let i = 0; i < 5; i++) {
      await new Promise(requestAnimationFrame);
      await this.#settled();
      if (align === 'start' || !this.#measuring() || !this.#scrollRowTo(index, align)) break;
    }
    return index < this.#model().rowCount;
  }

  /** `scrollToColumn()`: see its documentation on the element. */
  async toColumn(
    id: string,
    options: ScrollToColumnOptions,
    virtualize: () => boolean,
  ): Promise<boolean> {
    const host = this.#host;
    await host.updateComplete;
    const column = this.#model().columns.find((c) => c.id === id && c.kind === 'data');
    if (!column) return false;
    if (column.pin !== undefined) return true;
    if (virtualize()) {
      this.keep = id;
      host.requestUpdate();
      await host.updateComplete;
    }
    this.#scrollColumnTo(id, options.align ?? 'nearest');
    if (this.keep !== undefined) {
      this.keep = undefined;
      host.requestUpdate();
    }
    // The column window moves with the scroll event, before the next frame.
    await new Promise(requestAnimationFrame);
    await host.updateComplete;
    return true;
  }

  /** `setState()`'s `scroll`, once the restored state has rendered. */
  async restoreScroll(scroll: ScrollState): Promise<void> {
    const model = this.#model();
    this.#virtual.scrollToIndex(positionOfIndex(model, scroll.row));
    // A data source counts one page past its loaded rows until it knows the
    // total: scroll on as the count grows.
    const count = model.rowCount;
    if (this.#data.cache?.totalKnown === false && scroll.row >= count) {
      this.#target = { row: scroll.row, count, align: 'start' };
    }
    const scroller = this.#scroller();
    if (scroller && scroll.inline >= 0) {
      scroller.scrollLeft = scroll.inline * directionOf(this.#host);
    }
    // The scroll event comes before the next frame, and the rows move with its update.
    await new Promise(requestAnimationFrame);
    await this.#settled();
  }

  /**
   * Scrolls on toward the row `setState()` restored, or `scrollToRow()` asked
   * for, once more rows are counted.
   */
  chase(count: number): void {
    const target = this.#target;
    if (!target || target.count === count) return;
    target.count = count;
    this.#scrollRowTo(target.row, target.align);
    if (target.row < count || this.#data.cache?.totalKnown !== false) this.#target = undefined;
  }

  /** Scrolls row `index` to `align` in the body. Returns whether it moved. */
  #scrollRowTo(index: number, align: ScrollAlign): boolean {
    const model = this.#model();
    const { before, after } = this.#insets(layoutOf(model));
    return this.#virtual.scrollToIndex(positionOfIndex(model, index), align, before, after);
  }

  /**
   * Scrolls the column's header cell to `align` in the scrolling area. Measured,
   * not computed from widths: a flex column is as wide as its grid track.
   */
  #scrollColumnTo(id: string, align: ScrollAlign): void {
    const scroller = this.#scroller();
    const model = this.#model();
    const layout = layoutOf(model);
    const header = `[role='row'][aria-rowindex="${String(layout.header)}"]`;
    const cell = this.#host.renderRoot.querySelector(`${header} > [data-col="${CSS.escape(id)}"]`);
    if (!scroller || !cell) return;
    const direction = directionOf(this.#host);
    const ltr = direction === 1;
    const box = scroller.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    // The inner start edge: past the border, and past a scrollbar on that side.
    const edge = box.left + scroller.clientLeft + (ltr ? 0 : scroller.clientWidth);
    const pinStart = pinnedWidth(model.columns, 'start');
    const view = scroller.clientWidth - pinStart - pinnedWidth(model.columns, 'end');
    // Negative in RTL.
    const offset = Math.abs(scroller.scrollLeft);
    const start = offset + (ltr ? rect.left - edge : edge - rect.right) - pinStart;
    const target = alignOffset(start, rect.width, offset, view, align);
    const inline = Math.min(Math.round(target), scroller.scrollWidth - scroller.clientWidth);
    if (inline !== offset) scroller.scrollLeft = inline * direction;
  }

  /**
   * Waits for the update, and with `rowHeight: 'auto'` for the ones measured
   * rows request (a few at most: heights don't depend on positions).
   */
  async #settled(): Promise<void> {
    let done = await this.#host.updateComplete;
    for (let i = 0; i < 8 && !done && this.#measuring(); i++) {
      done = await this.#host.updateComplete;
    }
  }
}
