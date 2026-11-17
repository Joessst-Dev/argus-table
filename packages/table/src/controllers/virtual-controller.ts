import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  RowPool,
  RowSizes,
  ScrollScale,
  alignOffset,
  maxVisibleRows,
  steadyWindow,
  type ScrollAlign,
} from '@argus-table/core';

/** A rendered body row: its pool slot, its index in the row model and its offset. */
export interface WindowRow {
  slot: number;
  /** The row's displayed position: data rows and detail panels (`DisplayRows`). */
  index: number;
  /** The data index: the row's own, or for a panel the row it belongs to. `-1` for an idle slot. */
  row: number;
  /** Offset in the rendered body, in px (scaled bodies: relative to the scroll position). */
  start: number;
  /** Measured row heights (`auto`): the row's height, the least it renders at. */
  size?: number | undefined;
  /**
   * A pool slot no row uses now, rendered hidden rather than removed: with
   * panels, the data and panel rows in the window vary as they scroll, and a
   * removed slot would change slot assignment (WebKit cancels wheel scrolling).
   */
  idle?: boolean;
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
  /** Rendered data rows, in pool order (ADR 0001 addendum). */
  rows: WindowRow[];
  /** Rendered detail panels, from a pool of their own, in pool order. */
  details: WindowRow[];
  /** Rendered height of the body in px: all rows, or the cap. */
  totalSize: number;
  /** Visible positions, without overscan; `null` before the first layout. */
  range: { start: number; end: number } | null;
}

/** Rows measured as they render: every row (`rowHeight: 'auto'`), or the detail panels only. */
export interface MeasuredRows {
  /** Changes identity whenever the row at a position may have changed. */
  order: object;
  /** The position of a row id (a data row's or a panel's) in the current order. */
  indexOf: (id: string) => number | undefined;
  /** `true`: every row (`rowHeight: 'auto'`); `false`: detail panels only, data rows are the row height. */
  all: boolean;
}

export interface VirtualConfig {
  /** Displayed positions: data rows and detail panels. */
  count: number;
  /** The row height; with `auto`, the least a row is and what an unmeasured row counts as. */
  rowHeight: number;
  overscan: number;
  /** Row id at a position (a panel has an id of its own); pool slots follow row ids. */
  rowIdAt: (index: number) => string;
  /**
   * With detail panels: whether a position is a panel (it takes a slot of the
   * panel pool), and the data index at a position. Without them every position
   * is a data row.
   */
  details?:
    | {
        isDetail: (index: number) => boolean;
        dataIndexAt: (index: number) => number;
        /** The position of a row id, a data row's or a panel's. */
        positionOf: (id: string) => number | undefined;
      }
    | undefined;
  /**
   * Only panels opened or closed since the last configure, the rows in the
   * same order: the row at the top keeps its place on screen.
   */
  keepTop?: boolean;
  /**
   * The row to keep rendered outside the range (the one holding the grid's tab
   * stop), so its DOM and focus survive scrolling. `undefined`: none.
   */
  keep?: { id: string; index: number } | undefined;
  /** The tallest the body may render when it is `logical` px tall (`bodyCap()`); a taller one scrolls scaled. */
  cap: (logical: number) => number;
  /** Rows of different heights, measured as they render (`measureRows`). */
  measure?: MeasuredRows | undefined;
}

/**
 * Row virtualization plus the row pool: which rows render, where, and which
 * pool slot's DOM each one uses. Rows are laid out by `RowSizes` (offsets and
 * the row at an offset in O(log n); with fixed heights every row is the row
 * height and nothing is allocated). The controller listens to the scroller's
 * scroll events and size, and requests an update when the visible rows change.
 *
 * Scroll scaling: engines limit an element's height, so a body taller than the
 * cap renders at the cap and its scroll position maps linearly onto the rows
 * (`ScrollScale`). Offsets here are logical; rows render relative to the scroll
 * position (`start` minus the difference between the logical and the physical
 * offset), so a scaled body re-renders on every scroll. Scroll through this
 * controller (`scrollBy`, `reveal`, `scrollToIndex`): physical px no longer
 * match rows once the body is scaled.
 *
 * Rows of different heights (`auto`): heights are measured as rows render and
 * follow row ids, so a sort or filter keeps them. A measured row above the top
 * row would move the rows in view: unscaled, the rows render shifted by the
 * difference until scrolling stops (`#hold`); scaled, the mapping pivots at the
 * current offset. Neither writes the scroll position while the user scrolls.
 */
export class VirtualController implements ReactiveController {
  readonly #pool = new RowPool();
  /** Detail panels' pool slots: a pooled row never switches between a data row and a panel. */
  #detailPool = new RowPool();
  readonly #scale = new ScrollScale();
  readonly #host: ReactiveControllerHost;
  readonly #getScrollElement: () => HTMLElement | null;
  #element: HTMLElement | undefined;
  #config: VirtualConfig = {
    count: 0,
    rowHeight: 40,
    overscan: 6,
    rowIdAt: String,
    cap: () => Infinity,
  };
  /** A logical offset to restore after the update, once the body has its new height. */
  #anchor: number | undefined;
  /** Row heights by index: all the row height, or measured (auto mode). */
  readonly #sizes = new RowSizes();
  // Auto mode only.
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
  /** `reveal()` scrolled: render at the new offset even if the visible rows are the same. */
  #follow = false;
  /** The scroller this controller listens to. */
  #listening: HTMLElement | undefined;
  #resizeObserver: ResizeObserver | undefined;

  constructor(host: ReactiveControllerHost, getScrollElement: () => HTMLElement | null) {
    this.#host = host;
    this.#getScrollElement = getScrollElement;
    host.addController(this);
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
  #write(element: HTMLElement, logical: number, round?: (px: number) => number): void {
    const scale = this.#scale;
    if (!scale.scaled) {
      this.#dropHold();
      element.scrollTo({ top: logical });
      return;
    }
    const range = element.scrollHeight - element.clientHeight;
    const target = Math.min(Math.max(logical, 0), range + scale.excess);
    const physical = scale.toPhysical(target, range);
    element.scrollTo({ top: round ? round(physical) : physical });
    scale.land(target, element.scrollTop);
  }

  configure(next: VirtualConfig): void {
    const prev = this.#config;
    this.#config = next;
    const element = this.#element;
    // Read before the new mapping: a rescale keeps the logical offset.
    const top = element ? this.#top(element) : 0;
    const wasScaled = this.#scale.excess > 0;
    // Only panels opened or closed: the row at the top, under the old layout.
    const kept = next.keepTop && element ? this.#topRow(prev, top) : undefined;
    if (next.measure) {
      this.#configureMeasured(next.measure, prev);
    } else {
      if (prev.measure) {
        // Back to fixed heights: measured heights no longer apply.
        this.#heights.clear();
        this.#order = undefined;
        this.#quantum = 1;
        this.#dropHold();
      }
      // Every row the row height: allocates nothing.
      this.#sizes.reset(next.count, next.rowHeight);
    }
    if (!next.details) this.#detailPool = new RowPool();
    const index = kept && next.details?.positionOf(kept.id);
    if (kept && index !== undefined) {
      const logical = this.#sizes.total;
      this.#scale.configure(logical, next.cap(logical));
      this.#keepAt(this.#sizes.startOf(index) + kept.within, top, wasScaled);
      return;
    }
    this.#rescale(this.#sizes.total, top);
  }

  /** The id of the row at logical offset `top` under `config`, and how far into it `top` is. */
  #topRow(config: VirtualConfig, top: number): { id: string; within: number } | undefined {
    const sizes = this.#sizes;
    if (sizes.count === 0) return undefined;
    const index = sizes.indexAt(top);
    return { id: config.rowIdAt(index), within: top - sizes.startOf(index) };
  }

  /**
   * Keeps what is at logical offset `top` on screen now that it is at `target`,
   * without writing the scroll position while the user may be scrolling:
   * unscaled, the rows render shifted until scrolling stops (`#hold`); scaled,
   * the mapping pivots at the current offset.
   */
  #keepAt(target: number, top: number, wasScaled: boolean): void {
    const element = this.#element;
    const scale = this.#scale;
    if (!element) return;
    if (wasScaled && scale.scaled) {
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

  /**
   * A new logical body height. A new mapping would move the rows under a scaled
   * scroll position (a data source growing, a zoom change): keep the logical
   * offset (read before the new mapping) once the body has its new height.
   */
  #rescale(logical: number, offset: number): void {
    // Not `scaled`: TypeScript would take it for unchanged after `configure()`.
    const wasScaled = this.#scale.excess > 0;
    if (!this.#scale.configure(logical, this.#config.cap(logical))) return;
    if ((wasScaled || this.#scale.scaled) && offset > 0) this.#anchor = offset;
  }

  #configureMeasured(measure: MeasuredRows, prev: VirtualConfig): void {
    const next = this.#config;
    const sizes = this.#sizes;
    if (prev.measure?.all !== measure.all || next.rowHeight !== prev.rowHeight) {
      // A new minimum height (density, a theme): every row measures again.
      this.#heights.clear();
      this.#order = undefined;
    }
    const reset = () => {
      sizes.reset(next.count, this.#fit(0), this.#known(measure, next.count));
    };
    if (measure.order !== this.#order) {
      this.#order = measure.order;
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
  }

  /** The measured heights by index in the current order. Forgets rows long gone. */
  *#known(measure: MeasuredRows, count: number): Generator<[number, number]> {
    const heights = this.#heights;
    const prune = heights.size > 2 * count + 1000;
    for (const [id, px] of heights) {
      const index = measure.indexOf(id);
      if (index !== undefined && index < count) yield [index, this.#fit(px)];
      else if (prune) heights.delete(id);
    }
  }

  /** The px grid rows are on for a body `logical` px tall (see `COARSE_BODY`). */
  #quantumFor(logical: number): number {
    // Fixed-height data rows aren't on a measured grid: only panels are measured.
    if (!this.#config.measure?.all) return 1;
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
    // The logical offset is the same, so the visible rows may be too; the
    // rows still have to move to the new physical one.
    this.#host.requestUpdate();
  }

  hostConnected(): void {
    // Back in the document (a move): listen again once the update has rendered.
    this.#host.requestUpdate();
  }

  hostDisconnected(): void {
    this.#unlisten();
  }

  /** Listens to the scroller's scrolling and size: either can change the visible rows. */
  #listen(): void {
    const element = this.#getScrollElement();
    if (element === (this.#listening ?? null)) return;
    this.#unlisten();
    if (!element) return;
    this.#element = element;
    this.#listening = element;
    element.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#resizeObserver ??= new ResizeObserver(this.#onScroll);
    this.#resizeObserver.observe(element);
    // The first rows render with the next update, not a frame later when the
    // observer first reports: code awaiting `updateComplete` finds them.
    this.#onScroll();
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

  /**
   * Re-renders when the visible rows have changed, and on every scroll of a
   * scaled body (its rows render relative to the scroll position).
   */
  readonly #onScroll = () => {
    if (this.#holdTimer !== undefined) {
      clearTimeout(this.#holdTimer);
      this.#holdTimer = setTimeout(this.#flushHold, HOLD_MS);
    }
    const visible = this.#visible();
    const rendered = this.#rendered;
    if (
      this.#scale.scaled ||
      this.#follow ||
      visible?.start !== rendered?.start ||
      visible?.end !== rendered?.end
    ) {
      this.#host.requestUpdate();
    }
  };

  /** The visible rows (without overscan) and the logical offset, or `undefined` before layout. */
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
   * The rows to render from `pool`, in pool order: each holds its pool slot while
   * in range. With `idle`, every slot the pool has made is returned, the unused
   * ones as idle, so none is removed while scrolling.
   */
  #pooled(pool: RowPool, byId: Map<string, Omit<WindowRow, 'slot'>>, idle: boolean): WindowRow[] {
    const bySlot = new Map<number, WindowRow>();
    for (const { id, slot } of pool.update(byId.keys())) {
      const item = byId.get(id);
      if (item) bySlot.set(slot, { slot, ...item });
    }
    if (!idle) return [...bySlot.values()];
    // Every slot, in slot order: the unused ones idle.
    return Array.from(
      { length: pool.size },
      (_, slot) => bySlot.get(slot) ?? { slot, index: -1, row: -1, start: 0, idle: true },
    );
  }

  /** Computes the rendered window and updates the pools. Call once per render. */
  computeWindow(): VirtualWindow {
    const { count, overscan, rowHeight, keep, rowIdAt, details } = this.#config;
    const sizes = this.#sizes;
    const scale = this.#scale;
    const element = this.#element;
    const visible = this.#visible();
    this.#rendered = visible;
    this.#follow = false;
    // Fixed heights: rows take theirs from CSS.
    const measured = (size: number) => (this.#config.measure ? size : undefined);
    const rowOf = (index: number) => (details ? details.dataIndexAt(index) : index);
    // Scaled: rows render relative to the scroll position. Unscaled: shifted by the held correction.
    const shift = visible && element ? visible.top - element.scrollTop : 0;
    const byId = new Map<string, Omit<WindowRow, 'slot'>>();
    if (visible && element) {
      const indexes = steadyWindow(
        { startIndex: visible.start, endIndex: visible.end, overscan, count },
        maxVisibleRows(element.clientHeight, rowHeight),
      );
      const first = indexes[0];
      let start = first === undefined ? 0 : sizes.startOf(first);
      for (const index of indexes) {
        const size = sizes.sizeOf(index);
        byId.set(rowIdAt(index), {
          index,
          row: rowOf(index),
          start: start - shift,
          size: measured(size),
        });
        start += size;
      }
    }
    const keepDetail = keep !== undefined && details?.isDetail(keep.index) === true;
    this.#pool.pin(keepDetail ? undefined : keep?.id);
    this.#detailPool.pin(keepDetail ? keep.id : undefined);
    if (keep && !byId.has(keep.id) && keep.index < count) {
      // Scaled, it is out of view: keep it inside the body (or just above it).
      const size = sizes.sizeOf(keep.index);
      const start = sizes.startOf(keep.index) - shift;
      byId.set(keep.id, {
        index: keep.index,
        row: rowOf(keep.index),
        start: scale.scaled ? Math.min(Math.max(start, -size), scale.size) : start,
        size: measured(size),
      });
    }
    let rows: WindowRow[];
    let panels: WindowRow[] = [];
    if (details) {
      const data = new Map<string, Omit<WindowRow, 'slot'>>();
      const detail = new Map<string, Omit<WindowRow, 'slot'>>();
      for (const [id, item] of byId) (details.isDetail(item.index) ? detail : data).set(id, item);
      rows = this.#pooled(this.#pool, data, true);
      panels = this.#pooled(this.#detailPool, detail, true);
    } else {
      rows = this.#pooled(this.#pool, byId, false);
    }
    return {
      rows,
      details: panels,
      totalSize: scale.scaled ? scale.size : sizes.total,
      range: visible ? { start: visible.start, end: visible.end } : null,
    };
  }

  /**
   * Measured rows: records the heights of rendered body rows (`[position, px]`), read
   * once their content has rendered. Heights under the row height count as it.
   * Returns whether any changed; the controller then requests the update that
   * places the rows. Rows above the top row keep the rows in view in place.
   */
  measureRows(measured: Iterable<readonly [number, number]>): boolean {
    const { measure, rowIdAt, cap } = this.#config;
    if (!measure) return false;
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
    // Keep the rows in view where they are without moving the scroller.
    if (scale.configure(logical, cap(logical))) this.#keepAt(target, top, wasScaled);
    this.#host.requestUpdate();
    return true;
  }

  /** The height of the row at `index` (auto mode: measured, or the row height). */
  sizeOf(index: number): number {
    return this.#sizes.sizeOf(index);
  }

  /** The logical offset of the row at `index` in the body. */
  startOf(index: number): number {
    return this.#sizes.startOf(index);
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

  /** Whether the body is taller than the cap and scrolls scaled. */
  get scaled(): boolean {
    return this.#scale.scaled;
  }

  /** The index of the row at the top of the body (0 before the first layout). */
  get topRow(): number {
    const element = this.#element;
    // Half a px of slack: engines round scroll offsets to device pixels.
    return element ? this.#sizes.indexAt(this.#top(element) + 0.5) : 0;
  }

  /**
   * Scrolls row `index` to where `align` says, between the content above the
   * body (`before` px: the header and top pinned rows) and below it (`after`
   * px). An index past the last row counts as the last row. Returns whether it
   * moved a whole px or more.
   */
  scrollToIndex(index: number, align: ScrollAlign = 'start', before = 0, after = 0): boolean {
    const element = this.#element;
    if (!element) return false;
    const last = Math.max(0, this.#sizes.count - 1);
    const moved = this.#align(element, Math.min(Math.max(index, 0), last), align, before, after);
    this.#host.requestUpdate();
    return moved;
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
    this.#align(element, index, 'nearest', before, after);
    // Rendered for an offset the scroller has since left: they move with the
    // update after the scroll event.
    const behind = this.#rendered?.top !== this.#top(element);
    if (behind) this.#follow = true;
    return behind;
  }

  /**
   * Scrolls row `index` to where `align` says, between `before` and `after` px.
   * Returns whether it moved a whole px or more.
   */
  #align(
    element: HTMLElement,
    index: number,
    align: ScrollAlign,
    before: number,
    after: number,
  ): boolean {
    const offset = this.#top(element);
    const view = element.clientHeight - before - after;
    const start = this.startOf(index);
    const size = this.sizeOf(index);
    const target = alignOffset(start, size, offset, view, align);
    if (target === offset) return false;
    // Whole px that show the row in full: down from its start, up from its end.
    const round =
      target === start ? Math.floor : target === start + size - view ? Math.ceil : Math.round;
    this.#write(element, target, round);
    // Not past the end: the scroller stops there.
    return Math.abs(this.#top(element) - offset) >= 1;
  }
}
