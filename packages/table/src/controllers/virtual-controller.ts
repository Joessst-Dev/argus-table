import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { VirtualizerController } from '@tanstack/lit-virtual';
import { RowPool, ScrollScale, maxVisibleRows, steadyWindow } from '@argus-table/core';

/** A rendered body row: its pool slot, its index in the row model and its offset. */
export interface WindowRow {
  slot: number;
  index: number;
  /** Offset in the rendered body, in px (scaled bodies: relative to the scroll position). */
  start: number;
}

export interface VirtualWindow {
  /** Rendered rows, in pool order (ADR 0001 addendum). */
  rows: WindowRow[];
  /** Rendered height of the body in px: all rows, or the cap. */
  totalSize: number;
  /** Visible rows, without overscan; `null` before the first layout. */
  range: { start: number; end: number } | null;
}

export interface VirtualConfig {
  count: number;
  rowHeight: number;
  overscan: number;
  /** Row id at an index of the row model; pool slots follow row ids. */
  rowIdAt: (index: number) => string;
  /**
   * The row to keep rendered outside the range (the one holding the grid's tab
   * stop), so its DOM and focus survive scrolling. `undefined`: none.
   */
  keep?: { id: string; index: number } | undefined;
  /** The tallest the body may render (`bodyCap()`); a taller one scrolls scaled. */
  cap: number;
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
    cap: Infinity,
  };
  /** A logical offset to restore after the update, once the body has its new height. */
  #anchor: number | undefined;

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
    return scale.scaled ? scale.toLogical(top, element.scrollHeight - element.clientHeight) : top;
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
    if (
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
    if (this.#scale.configure(next.count * next.rowHeight, next.cap)) {
      // A new mapping would move the rows under a scaled scroll position (a data
      // source growing, a zoom change): keep the logical offset once the body
      // has its new height.
      if ((wasScaled || this.#scale.scaled) && offset !== null && offset > 0) {
        this.#anchor = offset;
      }
    }
  }

  hostUpdated(): void {
    const anchor = this.#anchor;
    if (anchor === undefined) return;
    this.#anchor = undefined;
    if (this.#element) this.#write(this.#element, anchor);
    // The logical offset is the same, so the virtualizer sees no change; the
    // rows still have to move to the new physical one.
    this.#host.requestUpdate();
  }

  /**
   * Computes the rendered window and updates the pool. Call once per render.
   */
  computeWindow(): VirtualWindow {
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
    // Half a px of slack: engines round scroll offsets to device pixels.
    const row = Math.floor((this.#top(element) + 0.5) / rowHeight);
    return Math.min(Math.max(row, 0), count - 1);
  }

  /** `'start'` puts the row at the top; `'auto'` scrolls only as far as needed to show it. */
  scrollToIndex(index: number, align: 'start' | 'auto' = 'start'): void {
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
    const { rowHeight } = this.#config;
    const offset = this.#top(element);
    const view = element.clientHeight - before - after;
    const start = index * rowHeight;
    let target: number;
    let round: ((px: number) => number) | undefined;
    if (start < offset) {
      target = start;
      round = Math.floor;
    } else if (start + rowHeight > offset + view) {
      target = start + rowHeight - view;
      round = Math.ceil;
    } else {
      target = offset;
    }
    if (target !== offset) this.#write(element, target, undefined, round);
    // Rendered for an offset the scroller has since left: they move with the
    // update after the scroll event.
    return this.#virtual.getVirtualizer().scrollOffset !== this.#top(element);
  }
}
