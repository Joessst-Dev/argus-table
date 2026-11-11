import type { ReactiveControllerHost } from 'lit';

/** The heights of the pinned row groups, in px. */
export interface PinnedHeights {
  top: number;
  bottom: number;
}

export interface RowMeasureOptions {
  /** A body row element's index in the row order; `undefined` to leave it out (a row still loading). */
  bodyIndex: (row: Element) => number | undefined;
  /** The height the virtualizer has for a body row now. */
  sizeOf: (index: number) => number;
  /** The least a row is (the row height). */
  minimum: () => number;
}

/**
 * Rows of different heights (`rowHeight: 'auto'`): reads the heights of the
 * rendered body rows and of the pinned row groups once their content has
 * rendered, and watches them for changes the table doesn't render (an image
 * loading, a web font, a framework component updating), which request an
 * update that reads them again. Pooled rows show other rows as the body
 * scrolls, so each update reads every rendered row that shows another row than
 * at its last read (all of them after `invalidate()`): one that now shows a row
 * of the same height doesn't resize, and the observer wouldn't report it.
 */
export class RowMeasure {
  readonly #host: ReactiveControllerHost;
  readonly #options: RowMeasureOptions;
  #observer: ResizeObserver | undefined;
  readonly #observed = new Set<Element>();
  #pinned: PinnedHeights = { top: 0, bottom: 0 };
  /** The row each body row element showed when it was last read. */
  #read = new WeakMap<Element, number>();
  /** Read every row next time, not only those that show another row now. */
  #all = true;

  constructor(host: ReactiveControllerHost, options: RowMeasureOptions) {
    this.#host = host;
    this.#options = options;
  }

  /** The pinned groups' heights from the last `read()`. */
  get pinned(): PinnedHeights {
    return this.#pinned;
  }

  /**
   * The next `read()` reads every row: their content may have changed size
   * (new data or columns, a resize, content that grew).
   */
  invalidate(): void {
    this.#all = true;
  }

  /**
   * Reads the rows in `root` (the shadow root): the body rows' heights as
   * `[index, px]`, and whether the pinned groups changed height. Scrolling,
   * only the pooled rows that now show another row are read.
   */
  read(root: ParentNode): { rows: [number, number][]; pinnedChanged: boolean } {
    const observer = (this.#observer ??= new ResizeObserver(this.#onResize));
    for (const element of this.#observed) {
      if (!element.isConnected) {
        observer.unobserve(element);
        this.#observed.delete(element);
      }
    }
    const rows: [number, number][] = [];
    const due: [Element, number][] = [];
    for (const row of root.querySelectorAll('[part~="body"] > .row')) {
      this.#observe(row);
      const index = this.#options.bodyIndex(row);
      if (index === undefined) {
        this.#read.delete(row);
      } else if (this.#all || this.#read.get(row) !== index) {
        due.push([row, index]);
      }
    }
    this.#all = false;
    // Body rows render at least their measured height (on the px grid): drop it
    // for one synchronous read, so rows can shrink too. Never painted.
    for (const [row] of due) row.setAttribute('data-measure-row', '');
    for (const [row, index] of due) {
      rows.push([index, row.getBoundingClientRect().height]);
      this.#read.set(row, index);
    }
    for (const [row] of due) row.removeAttribute('data-measure-row');
    const group = (side: 'top' | 'bottom') => {
      const element = root.querySelector(`.pinned[data-side="${side}"]`);
      if (element) this.#observe(element);
      return element ? element.getBoundingClientRect().height : 0;
    };
    const pinned = { top: group('top'), bottom: group('bottom') };
    const pinnedChanged =
      Math.abs(pinned.top - this.#pinned.top) > 0.01 ||
      Math.abs(pinned.bottom - this.#pinned.bottom) > 0.01;
    if (pinnedChanged) this.#pinned = pinned;
    return { rows, pinnedChanged };
  }

  /** Stops watching (fixed row heights again, or the table left the page). */
  stop(): void {
    this.#observer?.disconnect();
    this.#observed.clear();
    this.#pinned = { top: 0, bottom: 0 };
    this.#all = true;
  }

  #observe(element: Element): void {
    if (this.#observed.has(element)) return;
    this.#observed.add(element);
    this.#observer?.observe(element);
  }

  /** Requests an update only for a height the table doesn't have yet. */
  readonly #onResize = (entries: ResizeObserverEntry[]) => {
    const { bodyIndex, sizeOf, minimum } = this.#options;
    for (const entry of entries) {
      const target = entry.target;
      if (!target.isConnected) continue;
      const px = entry.borderBoxSize[0]?.blockSize ?? target.getBoundingClientRect().height;
      let known: number | undefined;
      if (target.classList.contains('pinned')) {
        known = target.getAttribute('data-side') === 'top' ? this.#pinned.top : this.#pinned.bottom;
      } else {
        const index = bodyIndex(target);
        if (index === undefined) continue;
        known = sizeOf(index);
        // Rows render at least their known height: only growing shows here.
        if (px < minimum() || px <= known + 0.01) continue;
      }
      if (Math.abs(px - known) > 0.01) {
        this.#all = true;
        this.#host.requestUpdate();
        return;
      }
    }
  };
}
