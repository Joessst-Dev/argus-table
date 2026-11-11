import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { VirtualizerController } from '@tanstack/lit-virtual';
import { RowPool, RowSizes, ScrollScale, maxVisibleRows, steadyWindow } from '@argus-table/core';

/** A rendered body row: its pool slot, its index in the row model and its offset. */
export interface WindowRow {
  slot: number;
  index: number;
  /** Offset in the rendered body, in px (scaled bodies: relative to the scroll position). */
  start: number;
  /** Measured row heights (`auto`): the row's height, the least it renders at. */
  size?: number;
}

/**
 * Engines place elements in a body taller than this (2^24 px) only to 2 px:
 * positions are 32-bit floats. Measured rows are whole px below it and an even
 * number of px above it, so every row starts on the grid and they stay flush.
 */
const COARSE_BODY = 16_000_000;

/** How long scrolling has to be quiet before a held correction is written (see `#hold`). */
const HOLD_MS = 150;

export interface VirtualWindow {
  /** Rendered rows, in pool order (ADR 0001 addendum). */
  rows: WindowRow[];
  /** Rendered height of the body in px: all rows, or the cap. */
  totalSize: number;
  /** Visible rows, without overscan; `null` before the first layout. */
  range: { start: number; end: number } | null;
}

/** Measured row heights (`rowHeight: 'auto'`). */
export interface AutoRows {
  /** Changes identity whenever the row at an index may have changed (the model's `rowOrder`). */
  order: object;
  /** The index of a row id in the current order. */
  indexOf: (id: string) => number | undefined;
}

export interface VirtualConfig {
  count: number;
  /** The row height; with `auto`, the least a row is and what an unmeasured row counts as. */
  rowHeight: number;
  overscan: number;
  /** Row id at an index of the row model; pool slots follow row ids. */
  rowIdAt: (index: number) => string;
  /**
   * The row to keep rendered outside the range (the one holding the grid's tab
   * stop), so its DOM and focus survive scrolling. `undefined`: none.
   */
  keep?: { id: string; index: number } | undefined;
  /** The tallest the body may render when it is `logical` px tall (`bodyCap()`); a taller one scrolls scaled. */
  cap: (logical: number) => number;
  /** Rows of different heights, measured as they render (`measureRows`). */
  auto?: AutoRows | undefined;
}

/**
 * Row virtualization (TanStack Virtual) plus the row pool: which rows render,
 * where, and which pool slot's DOM each one uses. The virtualizer registers itself
 * with the host and requests updates on scroll.
 *
 * Scroll scaling: engines limit an element's height, so a body taller than the
 * cap renders at the cap and its scroll position maps linearly onto the rows
 * (`ScrollScale`). The virtualizer works in logical offsets: it gets a stand-in
 * for the scroller whose `scrollTop`, `scrollHeight` and `scrollTo()` are
 * logical, and everything else passes through. Rows render relative to the
 * scroll position (`start` minus the difference between the logical and the
 * physical offset). Scroll through this controller (`scrollBy`, `reveal`,
 * `scrollToIndex`): physical px no longer match rows once the body is scaled.
 *
 * Rows of different heights (`auto`): TanStack's own measuring recomputes every
 * row below a measured one, too slow for a million rows, so in this mode the
 * virtualizer sits idle (no rows) and the controller does its part: the window
 * from `RowSizes` (heights by index, O(log n) offsets), a scroll listener that
 * re-renders when the window moves, and anchoring. Heights follow row ids, so
 * a sort or filter keeps them. A measured row above the top row would move
 * the rows in view: unscaled, the rows render shifted by the difference until
 * scrolling stops (`#hold`); scaled, the mapping pivots at the current offset.
 * Neither writes the scroll position while the user scrolls.
 */
export class VirtualController implements ReactiveController {
  readonly #virtual: VirtualizerController<HTMLElement, Element>;
  readonly #pool = new RowPool();
  readonly #scale = new ScrollScale();
  readonly #host: ReactiveControllerHost;
  readonly #getScrollElement: () => HTMLElement | null;
  #element: HTMLElement | undefined;
  #standIn: HTMLElement | undefined;
  #config: VirtualConfig = {
    count: 0,
    rowHeight: 40,
    overscan: 6,
    rowIdAt: String,
    cap: () => Infinity,
  };
  /** A logical offset to restore after the update, once the body has its new height. */
  #anchor: number | undefined;
  // Auto mode only.
  readonly #sizes = new RowSizes();
  /** Measured heights by row id (as read), so they follow rows through a sort or filter. */
  readonly #heights = new Map<string, number>();
  /** Rows are whole multiples of this many px (see `COARSE_BODY`). */
  #quantum = 1;
  /**
   * Unscaled: the logical offset less the scroller's. Rows measured above the
   * top row would move the rows in view; instead of writing the scroll position
   * (which cancels a wheel or touch scroll in progress, in WebKit at once) the
   * rows render shifted by this much, and it is written once scrolling has been
   * quiet for `HOLD_MS`.
   */
  #hold = 0;
  #holdTimer: ReturnType<typeof setTimeout> | undefined;
  /** The `order` the sizes are indexed for. */
  #order: object | undefined;
  /** The visible rows last rendered, and the logical offset they were rendered for. */
  #rendered: { start: number; end: number; top: number } | undefined;
  /** The scroller this controller listens to (auto mode). */
  #listening: HTMLElement | undefined;
  #resizeObserver: ResizeObserver | undefined;

  constructor(host: ReactiveControllerHost, getScrollElement: () => HTMLElement | null) {
    this.#host = host;
    this.#getScrollElement = getScrollElement;
    this.#virtual = new VirtualizerController<HTMLElement, Element>(host, {
      count: 0,
      getScrollElement: () => this.#scroller(),
      // The real element: a ResizeObserver can't observe the stand-in.
      observeElementRect: (_instance, cb) => {
        const element = this.#element;
        if (!element) return undefined;
        const report = () => {
          cb({ width: element.clientWidth, height: element.clientHeight });
        };
        report();
        const observer = new ResizeObserver(report);
        observer.observe(element);
        return () => {
          observer.disconnect();
        };
      },
      estimateSize: () => this.#config.rowHeight,
      overscan: this.#config.overscan,
      // One window size from the first render: the pool never grows while scrolling
      // (in WebKit, new rows' slots would cut a wheel scroll short; see steadyWindow).
      rangeExtractor: (range) =>
        steadyWindow(
          range,
          maxVisibleRows(this.#element?.clientHeight ?? 0, this.#config.rowHeight),
        ),
    });
    host.addController(this);
  }

  /** The scroller's stand-in for the virtualizer: vertical offsets and height in logical px. */
  #scroller(): HTMLElement | null {
    const element = this.#getScrollElement();
    if (!element) return null;
    if (this.#element !== element || !this.#standIn) {
      this.#element = element;
      this.#standIn = new Proxy(element, {
        get: (target, key) => {
          if (key === 'scrollTop') return this.#top(target);
          if (key === 'scrollHeight') return target.scrollHeight + this.#scale.excess;
          if (key === 'scrollTo') {
            return (options: ScrollToOptions) => {
              if (options.top === undefined) target.scrollTo(options);
              else this.#write(target, options.top, options.behavior);
            };
          }
          const value: unknown = Reflect.get(target, key);
          // Methods run on the element itself (DOM methods reject the proxy).
          return typeof value === 'function'
            ? (value as (...args: unknown[]) => unknown).bind(target)
            : value;
        },
      });
    }
    return this.#standIn;
  }

  /** The scroller's logical offset. */
  #top(element: HTMLElement): number {
    const top = element.scrollTop;
    const scale = this.#scale;
    return scale.scaled
      ? scale.toLogical(top, element.scrollHeight - element.clientHeight)
      : top + this.#hold;
  }

  /**
   * Scrolls to a logical offset. `round` rounds the physical one, so that a
   * scaled offset moves the scroller at all.
   */
  #write(
    element: HTMLElement,
    logical: number,
    behavior?: ScrollBehavior,
    round?: (px: number) => number,
  ): void {
    const scale = this.#scale;
    if (!scale.scaled) {
      this.#dropHold();
      element.scrollTo({ top: logical, behavior });
      return;
    }
    const range = element.scrollHeight - element.clientHeight;
    const target = Math.min(Math.max(logical, 0), range + scale.excess);
    const physical = scale.toPhysical(target, range);
    element.scrollTo({ top: round ? round(physical) : physical, behavior });
    if (behavior !== 'smooth') scale.land(target, element.scrollTop);
  }

  configure(next: VirtualConfig): void {
    const prev = this.#config;
    this.#config = next;
    if (next.auto) {
      this.#configureAuto(next.auto, prev);
      return;
    }
    if (prev.auto) {
      // Back to fixed heights: the virtualizer takes over again.
      this.#heights.clear();
      this.#sizes.reset(0, next.rowHeight);
      this.#order = undefined;
      this.#rendered = undefined;
      this.#dropHold();
      this.#virtual.setOptions({ count: next.count, overscan: next.overscan });
      this.#virtual.getVirtualizer().measure();
    } else if (
      next.count !== prev.count ||
      next.overscan !== prev.overscan ||
      next.rowHeight !== prev.rowHeight
    ) {
      this.#virtual.setOptions({ count: next.count, overscan: next.overscan });
      if (next.rowHeight !== prev.rowHeight) this.#virtual.getVirtualizer().measure();
    }
    // Not `scaled`: TypeScript would take it for unchanged after `configure()`.
    const wasScaled = this.#scale.excess > 0;
    const offset = this.#virtual.getVirtualizer().scrollOffset;
    const logical = next.count * next.rowHeight;
    if (this.#scale.configure(logical, next.cap(logical))) {
      // A new mapping would move the rows under a scaled scroll position (a data
      // source growing, a zoom change): keep the logical offset once the body
      // has its new height.
      if ((wasScaled || this.#scale.scaled) && offset !== null && offset > 0) {
        this.#anchor = offset;
      }
    }
  }

  #configureAuto(auto: AutoRows, prev: VirtualConfig): void {
    const next = this.#config;
    if (!prev.auto) this.#virtual.setOptions({ count: 0 });
    const sizes = this.#sizes;
    if (!prev.auto || next.rowHeight !== prev.rowHeight) {
      // A new minimum height (density, a theme): every row measures again.
      this.#heights.clear();
      this.#order = undefined;
    }
    const reset = () => {
      sizes.reset(next.count, this.#fit(0), this.#known(auto, next.count));
    };
    if (auto.order !== this.#order) {
      this.#order = auto.order;
      reset();
    } else if (next.count !== sizes.count) {
      // A data source counting more rows: they keep their indexes.
      sizes.resize(next.count);
    }
    // A body past 2^24 px needs even heights: fit the rows to the new grid.
    const quantum = this.#quantumFor(sizes.total);
    if (quantum !== this.#quantum) {
      this.#quantum = quantum;
      reset();
    }
    const element = this.#element;
    const wasScaled = this.#scale.excess > 0;
    const offset = element ? this.#top(element) : 0;
    const logical = sizes.total;
    if (this.#scale.configure(logical, next.cap(logical))) {
      if ((wasScaled || this.#scale.scaled) && offset > 0) this.#anchor = offset;
    }
  }

  /** The measured heights by index in the current order. Forgets rows long gone. */
  *#known(auto: AutoRows, count: number): Generator<[number, number]> {
    const heights = this.#heights;
    const prune = heights.size > 2 * count + 1000;
    for (const [id, px] of heights) {
      const index = auto.indexOf(id);
      if (index !== undefined && index < count) yield [index, this.#fit(px)];
      else if (prune) heights.delete(id);
    }
  }

  /** The px grid rows are on for a body `logical` px tall (see `COARSE_BODY`). */
  #quantumFor(logical: number): number {
    return Math.min(logical, this.#config.cap(logical)) > COARSE_BODY ? 2 : 1;
  }

  /** A measured height as a row renders it: on the grid, at least the row height. */
  #fit(px: number): number {
    const q = this.#quantum;
    const up = (value: number) => Math.ceil(value / q - 0.01) * q;
    return Math.max(up(px), up(this.#config.rowHeight));
  }

  hostUpdated(): void {
    this.#listen();
    const anchor = this.#anchor;
    if (anchor === undefined) return;
    this.#anchor = undefined;
    if (this.#element) this.#write(this.#element, anchor);
    // The logical offset is the same, so the virtualizer sees no change; the
    // rows still have to move to the new physical one.
    this.#host.requestUpdate();
  }

  hostDisconnected(): void {
    this.#unlisten();
  }

  /**
   * Auto mode: the virtualizer has no rows, so it reports neither scrolling nor
   * a new viewport size. Listen to the scroller here.
   */
  #listen(): void {
    const element = this.#config.auto ? this.#getScrollElement() : null;
    if (element === (this.#listening ?? null)) return;
    this.#unlisten();
    if (!element) return;
    this.#scroller();
    this.#listening = element;
    element.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#resizeObserver ??= new ResizeObserver(this.#onScroll);
    // Reports the size once right away, which renders the first rows.
    this.#resizeObserver.observe(element);
  }

  #unlisten(): void {
    this.#listening?.removeEventListener('scroll', this.#onScroll);
    this.#resizeObserver?.disconnect();
    this.#listening = undefined;
    this.#dropHold();
  }

  #dropHold(): void {
    clearTimeout(this.#holdTimer);
    this.#holdTimer = undefined;
    this.#hold = 0;
  }

  /** Writes the held correction: the rows stay where they are on screen. */
  readonly #flushHold = () => {
    this.#holdTimer = undefined;
    const element = this.#element;
    if (!element || this.#hold === 0) return;
    const logical = this.#top(element);
    this.#hold = 0;
    element.scrollTo({ top: logical });
    this.#host.requestUpdate();
  };

  /** Re-renders when the visible rows have changed. */
  readonly #onScroll = () => {
    if (this.#holdTimer !== undefined) {
      clearTimeout(this.#holdTimer);
      this.#holdTimer = setTimeout(this.#flushHold, HOLD_MS);
    }
    const visible = this.#visible();
    const rendered = this.#rendered;
    if (visible?.start !== rendered?.start || visible?.end !== rendered?.end) {
      this.#host.requestUpdate();
    }
  };

  /** Auto mode: the visible rows (without overscan) and the logical offset, or `undefined` before layout. */
  #visible(): { start: number; end: number; top: number } | undefined {
    const element = this.#element;
    const sizes = this.#sizes;
    const view = element?.clientHeight ?? 0;
    if (!element || sizes.count === 0 || view <= 0) return undefined;
    const top = this.#top(element);
    const start = sizes.indexAt(top);
    // The last row that starts above the bottom edge.
    const end = Math.max(start, sizes.indexAt(top + view - 0.5));
    return { start, end, top };
  }

  /**
   * Computes the rendered window and updates the pool. Call once per render.
   */
  computeWindow(): VirtualWindow {
    if (this.#config.auto) return this.#autoWindow();
    const v = this.#virtual.getVirtualizer();
    const items = v.getVirtualItems();
    // Scaled: rows render relative to the scroll position. The physical offset is
    // read now, so rows for the virtualizer's offset fill the view even if the
    // scroller has moved on since its last scroll event.
    const scaled = this.#scale.scaled;
    const size = this.#scale.size;
    const shift = scaled ? (v.scrollOffset ?? 0) - (this.#element?.scrollTop ?? 0) : 0;
    const byId = new Map<string, { index: number; start: number }>();
    for (const item of items) {
      byId.set(this.#config.rowIdAt(item.index), { index: item.index, start: item.start - shift });
    }
    const { keep, rowHeight } = this.#config;
    this.#pool.pin(keep?.id);
    if (keep && !byId.has(keep.id)) {
      // Fixed row heights: the virtualizer would place it here too. Scaled, it is
      // out of view: keep it inside the body (or just above it, under the header),
      // so it doesn't stretch the scroll range past the cap.
      const start = keep.index * rowHeight - shift;
      byId.set(keep.id, {
        index: keep.index,
        start: scaled ? Math.min(Math.max(start, -rowHeight), size) : start,
      });
    }
    const rows: WindowRow[] = [];
    for (const { id, slot } of this.#pool.update(byId.keys())) {
      const item = byId.get(id);
      if (item) rows.push({ slot, ...item });
    }
    const range = v.range;
    return {
      rows,
      totalSize: scaled ? size : v.getTotalSize(),
      range: range ? { start: range.startIndex, end: range.endIndex } : null,
    };
  }

  /** `computeWindow()` for rows of different heights. */
  #autoWindow(): VirtualWindow {
    const { count, overscan, rowHeight, keep, rowIdAt } = this.#config;
    const sizes = this.#sizes;
    const scale = this.#scale;
    const element = this.#element;
    const visible = this.#visible();
    this.#rendered = visible;
    // Scaled: rows render relative to the scroll position. Unscaled: shifted by the held correction.
    const shift = visible && element ? visible.top - element.scrollTop : 0;
    const byId = new Map<string, { index: number; start: number; size?: number }>();
    if (visible && element) {
      const indexes = steadyWindow(
        { startIndex: visible.start, endIndex: visible.end, overscan, count },
        maxVisibleRows(element.clientHeight, rowHeight),
      );
      const first = indexes[0];
      let start = first === undefined ? 0 : sizes.startOf(first);
      for (const index of indexes) {
        const size = sizes.sizeOf(index);
        byId.set(rowIdAt(index), { index, start: start - shift, size });
        start += size;
      }
    }
    this.#pool.pin(keep?.id);
    if (keep && !byId.has(keep.id) && keep.index < count) {
      // Scaled, it is out of view: keep it inside the body (or just above it).
      const size = sizes.sizeOf(keep.index);
      const start = sizes.startOf(keep.index) - shift;
      byId.set(keep.id, {
        index: keep.index,
        start: scale.scaled ? Math.min(Math.max(start, -size), scale.size) : start,
        size,
      });
    }
    const rows: WindowRow[] = [];
    for (const { id, slot } of this.#pool.update(byId.keys())) {
      const item = byId.get(id);
      if (item) rows.push({ slot, ...item });
    }
    return {
      rows,
      totalSize: scale.scaled ? scale.size : sizes.total,
      range: visible ? { start: visible.start, end: visible.end } : null,
    };
  }

  /**
   * Auto mode: records the heights of rendered body rows (`[index, px]`), read
   * once their content has rendered. Heights under the row height count as it.
   * Returns whether any changed; the controller then requests the update that
   * places the rows. Rows above the top row keep the rows in view in place.
   */
  measureRows(measured: Iterable<readonly [number, number]>): boolean {
    const { auto, rowIdAt, cap } = this.#config;
    if (!auto) return false;
    const sizes = this.#sizes;
    const element = this.#element;
    const top = element ? this.#top(element) : 0;
    const anchor = sizes.indexAt(top);
    const within = top - sizes.startOf(anchor);
    let changed = false;
    for (const [index, px] of measured) {
      if (index < 0 || index >= sizes.count || !(px > 0)) continue;
      this.#heights.set(rowIdAt(index), px);
      if (sizes.set(index, this.#fit(px)) !== 0) changed = true;
    }
    if (!changed) return false;
    const target = sizes.startOf(anchor) + within;
    const scale = this.#scale;
    const wasScaled = scale.excess > 0;
    const logical = sizes.total;
    if (scale.configure(logical, cap(logical)) && element) {
      if (wasScaled && scale.scaled) {
        // Keep the rows in view where they are without moving the scroller.
        scale.pivot(element.scrollTop, target, element.scrollHeight - element.clientHeight);
      } else if (wasScaled !== scale.scaled) {
        // Once the body has its new height (the write would clamp to the old one).
        this.#anchor = target;
      } else if (Math.abs(target - top) > 0.01) {
        this.#hold += target - top;
        clearTimeout(this.#holdTimer);
        this.#holdTimer = setTimeout(this.#flushHold, HOLD_MS);
      }
    }
    this.#host.requestUpdate();
    return true;
  }

  /** The height of the row at `index` (auto mode: measured, or the row height). */
  sizeOf(index: number): number {
    return this.#config.auto ? this.#sizes.sizeOf(index) : this.#config.rowHeight;
  }

  /** The logical offset of the row at `index` in the body. */
  startOf(index: number): number {
    return this.#config.auto ? this.#sizes.startOf(index) : index * this.#config.rowHeight;
  }

  /**
   * Auto mode: how many rows a page moves from row `from`, the rows that fit in
   * `view` px below it (`down`) or above it. At least one.
   */
  pageRows(from: number, down: boolean, view: number): number {
    const sizes = this.#sizes;
    const start = sizes.startOf(from);
    if (down) return Math.max(1, sizes.indexAt(start + view + 0.01) - from);
    // The first row that starts at most `view` px above this one.
    let to = sizes.indexAt(start - view);
    if (sizes.startOf(to) < start - view - 0.01) to += 1;
    return Math.max(1, from - to);
  }

  /** Number of pool slots created so far: bounded by the most rows rendered at once. */
  get poolSize(): number {
    return this.#pool.size;
  }

  /** Whether the body is taller than the cap and scrolls scaled. */
  get scaled(): boolean {
    return this.#scale.scaled;
  }

  /** The index of the row at the top of the body (0 before the first layout). */
  get topRow(): number {
    const element = this.#element;
    const { count, rowHeight } = this.#config;
    if (!element || count === 0 || rowHeight <= 0) return 0;
    if (this.#config.auto) return this.#sizes.indexAt(this.#top(element) + 0.5);
    // Half a px of slack: engines round scroll offsets to device pixels.
    const row = Math.floor((this.#top(element) + 0.5) / rowHeight);
    return Math.min(Math.max(row, 0), count - 1);
  }

  /** `'start'` puts the row at the top; `'auto'` scrolls only as far as needed to show it. */
  scrollToIndex(index: number, align: 'start' | 'auto' = 'start'): void {
    if (this.#config.auto) {
      const element = this.#element;
      if (!element) return;
      if (align === 'auto') {
        this.reveal(index, 0, 0);
      } else {
        this.#write(element, this.#sizes.startOf(Math.min(Math.max(index, 0), this.#sizes.count)));
      }
      this.#host.requestUpdate();
      return;
    }
    this.#virtual.getVirtualizer().scrollToIndex(index, { align });
  }

  /** Scrolls by `delta` px of rows (logical px). */
  scrollBy(delta: number): void {
    const element = this.#element;
    if (element) this.#write(element, this.#top(element) + delta);
  }

  /** Scrolls to the start or the end of the body. */
  scrollToEdge(edge: 'start' | 'end'): void {
    const element = this.#element;
    // The end: #write clamps to the last logical offset.
    if (element) this.#write(element, edge === 'start' ? 0 : Number.MAX_SAFE_INTEGER);
  }

  /**
   * Scrolls the least distance that shows row `index` in full, between the
   * content above the body (`before` px: the header and top pinned rows) and
   * below it (`after` px). Returns whether the rows are yet to move there (with
   * the update after the scroll event): until then the row's DOM isn't where it
   * will be.
   */
  reveal(index: number, before: number, after: number): boolean {
    const element = this.#element;
    if (!element) return false;
    const auto = this.#config.auto !== undefined;
    const offset = this.#top(element);
    const view = element.clientHeight - before - after;
    const start = this.startOf(index);
    const size = this.sizeOf(index);
    let target: number;
    let round: ((px: number) => number) | undefined;
    // A row taller than the view shows its start.
    if (start < offset || (auto && size > view)) {
      target = start;
      round = Math.floor;
    } else if (start + size > offset + view) {
      target = start + size - view;
      round = Math.ceil;
    } else {
      target = offset;
    }
    if (target !== offset) this.#write(element, target, undefined, round);
    // Rendered for an offset the scroller has since left: they move with the
    // update after the scroll event.
    const rendered = auto ? this.#rendered?.top : this.#virtual.getVirtualizer().scrollOffset;
    return rendered !== this.#top(element);
  }
}
