import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { columnWindow, maxVisibleColumns, RowPool, type ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';

/** Scrolling columns rendered beyond each side of the visible ones. */
export const COLUMN_OVERSCAN = 2;

/**
 * A rendered column: the column, the slot its cells and light-DOM content use
 * (`h-{slot}`, `c-{row}-{slot}`), the key its cells are rendered by, and with
 * `virtualizeColumns` the grid track it is placed in.
 */
export type RenderedColumn<T> = ColumnView<T, CellContent> & {
  slot: number;
  key: unknown;
  /** Grid column the cells are placed in; `undefined`: in DOM order. */
  place: number | undefined;
};

type Column<T> = ColumnView<T, CellContent>;

/**
 * Column virtualization (`virtualizeColumns`): which columns render, and which
 * pool slot's DOM each one uses.
 *
 * Off, every column renders in visual order, its slot is its `colIndex` and
 * its cells are keyed by column id: the DOM is what it always was.
 *
 * On, the scrolling columns in view render, plus `COLUMN_OVERSCAN` on each
 * side, and the pinned columns, the checkbox column and the columns the table
 * keeps (the active one, one being dragged, auto widths still to measure)
 * whatever the scroll position. They are pooled like rows (ADR 0001): a column
 * entering the view reuses the cells, slots and content of one that left, so
 * the DOM is updated in place, and the window has one size, so the pool fills
 * on the first render and scrolling only reuses it (in WebKit, new slots
 * while scrolling cut a wheel scroll short; see `steadyWindow`). DOM order is
 * then pool order: each cell is placed in its grid column explicitly, and
 * `aria-colindex` carries the position, as `aria-rowindex` does for rows.
 */
export class ColumnWindowController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #scroller: () => HTMLElement | null;
  readonly #pool = new RowPool();
  #attached: HTMLElement | undefined;
  #resize: ResizeObserver | undefined;
  #enabled = false;
  /** The columns of the last render, and what the window was computed from. */
  #columns: readonly Column<T>[] = [];
  #scrolling: Column<T>[] = [];
  #pinnedWidth = 0;
  #maxVisible: { columns: readonly Column<T>[]; view: number; value: number } | undefined;
  /** First index and size of the last window rendered. */
  #key = '';

  constructor(host: ReactiveControllerHost & HTMLElement, scroller: () => HTMLElement | null) {
    this.#host = host;
    this.#scroller = scroller;
    host.addController(this);
  }

  hostConnected(): void {
    this.#attach();
  }

  hostUpdated(): void {
    this.#attach();
  }

  hostDisconnected(): void {
    this.#attached?.removeEventListener('scroll', this.#onScroll);
    this.#resize?.disconnect();
    this.#attached = undefined;
  }

  /** Number of column pool slots created so far. */
  get poolSize(): number {
    return this.#pool.size;
  }

  /**
   * The columns to render, given the model's columns in visual order. With
   * `enabled`, `keep` names columns to render wherever they are. Call once per
   * render.
   */
  compute(
    columns: readonly Column<T>[],
    enabled: boolean,
    keep: Iterable<string | undefined>,
  ): RenderedColumn<T>[] {
    this.#enabled = enabled;
    if (!enabled) {
      this.#pool.clear();
      this.#key = '';
      return columns.map((c) => ({ ...c, slot: c.colIndex, key: c.id, place: undefined }));
    }
    if (columns !== this.#columns) {
      this.#columns = columns;
      this.#scrolling = columns.filter((c) => c.kind === 'data' && c.pin === undefined);
      this.#pinnedWidth = columns.reduce((sum, c) => (c.pin ? sum + c.width : sum), 0);
    }
    const wanted = new Set<string | undefined>(keep);
    const window = this.#window();
    for (const i of window) wanted.add(this.#scrolling[i]?.id);
    this.#key = keyOf(window);
    // In visual order, so the first render's slots (and DOM order) follow the columns.
    const ids: string[] = [];
    const byId = new Map<string, Column<T>>();
    for (const c of columns) {
      if (c.pin !== undefined || c.kind !== 'data' || wanted.has(c.id)) {
        ids.push(c.id);
        byId.set(c.id, c);
      }
    }
    const rendered: RenderedColumn<T>[] = [];
    for (const { id, slot } of this.#pool.update(ids)) {
      const c = byId.get(id);
      if (c) rendered.push({ ...c, slot, key: slot, place: c.colIndex });
    }
    return rendered;
  }

  /** The window's indexes in the scrolling columns, for the scroller as it is now. */
  #window(): number[] {
    // Before the first render there is no scroller: the host is as wide.
    const s = this.#attached ?? this.#scroller();
    const view = Math.max(0, (s ?? this.#host).clientWidth - this.#pinnedWidth);
    const columns = this.#scrolling;
    let max = this.#maxVisible;
    if (max?.columns !== this.#columns || max.view !== view) {
      max = { columns: this.#columns, view, value: maxVisibleColumns(columns, view) };
      this.#maxVisible = max;
    }
    // Negative in RTL.
    const offset = Math.abs(s?.scrollLeft ?? 0);
    return columnWindow(columns, offset, view, COLUMN_OVERSCAN, max.value);
  }

  #attach(): void {
    const s = this.#scroller();
    if (!s || s === this.#attached) return;
    this.#attached?.removeEventListener('scroll', this.#onScroll);
    this.#attached = s;
    s.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#resize ??= new ResizeObserver(() => {
      this.#onScroll();
    });
    this.#resize.disconnect();
    this.#resize.observe(s);
  }

  /** Renders again when the window moves: not on every scroll event. */
  readonly #onScroll = () => {
    if (!this.#enabled) return;
    const window = this.#window();
    if (keyOf(window) !== this.#key) this.#host.requestUpdate();
  };
}

function keyOf(window: readonly number[]): string {
  return `${String(window[0] ?? -1)}:${String(window.length)}`;
}
