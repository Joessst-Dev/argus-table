import type { ReactiveControllerHost } from 'lit';
import { VirtualizerController } from '@tanstack/lit-virtual';
import { RowPool } from '@argus-table/core';

/** A rendered body row: its pool slot, its index in the row model and its offset. */
export interface WindowRow {
  slot: number;
  index: number;
  start: number;
}

export interface VirtualWindow {
  /** Rendered rows, in pool order (ADR 0001 addendum). */
  rows: WindowRow[];
  /** Height of all rows in px. */
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
}

/**
 * Row virtualization (TanStack Virtual) plus the row pool: which rows render,
 * where, and which pool slot's DOM each one uses. The virtualizer registers itself
 * with the host and requests updates on scroll.
 */
export class VirtualController {
  readonly #virtual: VirtualizerController<HTMLElement, Element>;
  readonly #pool = new RowPool();
  #config: VirtualConfig = { count: 0, rowHeight: 40, overscan: 6, rowIdAt: String };

  constructor(host: ReactiveControllerHost, getScrollElement: () => HTMLElement | null) {
    this.#virtual = new VirtualizerController<HTMLElement, Element>(host, {
      count: 0,
      getScrollElement,
      estimateSize: () => this.#config.rowHeight,
      overscan: this.#config.overscan,
    });
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
  }

  /**
   * Computes the rendered window and updates the pool. Call once per render.
   */
  computeWindow(): VirtualWindow {
    const v = this.#virtual.getVirtualizer();
    const items = v.getVirtualItems();
    const byId = new Map<string, { index: number; start: number }>();
    for (const item of items) {
      byId.set(this.#config.rowIdAt(item.index), { index: item.index, start: item.start });
    }
    const { keep } = this.#config;
    this.#pool.pin(keep?.id);
    if (keep && !byId.has(keep.id)) {
      // Fixed row heights: the virtualizer would place it here too.
      byId.set(keep.id, { index: keep.index, start: keep.index * this.#config.rowHeight });
    }
    const rows: WindowRow[] = [];
    for (const { id, slot } of this.#pool.update(byId.keys())) {
      const item = byId.get(id);
      if (item) rows.push({ slot, ...item });
    }
    const range = v.range;
    return {
      rows,
      totalSize: v.getTotalSize(),
      range: range ? { start: range.startIndex, end: range.endIndex } : null,
    };
  }

  /** Number of pool slots created so far: bounded by the most rows rendered at once. */
  get poolSize(): number {
    return this.#pool.size;
  }

  /** `'start'` puts the row at the top; `'auto'` scrolls only as far as needed to show it. */
  scrollToIndex(index: number, align: 'start' | 'auto' = 'start'): void {
    this.#virtual.getVirtualizer().scrollToIndex(index, { align });
  }
}
