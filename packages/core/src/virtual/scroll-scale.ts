/**
 * Maps the scroll position of a body that is too tall to render onto the rows.
 *
 * Engines limit an element's height (about 33.5M px in Chromium and WebKit, less
 * when zoomed; about 17.9M px in Firefox, which drops a taller element to 0). A
 * body taller than `cap` renders `cap` px tall, and the scroll position is scaled
 * linearly: the top of the physical scroll range is the first row, its bottom the
 * last. Offsets the virtualizer works with are logical (unscaled) px; the
 * scroller's `scrollTop` is physical. Under the cap the mapping is the identity.
 *
 * The scroll range is the scroller's: the body plus what scrolls with it (header,
 * pinned rows) minus the viewport, so pass the physical range,
 * `scrollHeight - clientHeight`. The logical range is longer by `excess`.
 */
export class ScrollScale {
  #logical = 0;
  #cap = Infinity;
  /** The logical offset last written and the physical offset it landed on. */
  #landed: { physical: number; logical: number } | undefined;

  /**
   * `logical`: the height of all body rows in px. `cap`: the tallest body the
   * engine renders. Returns whether anything changed.
   */
  configure(logical: number, cap: number): boolean {
    if (logical === this.#logical && cap === this.#cap) return false;
    this.#logical = logical;
    this.#cap = cap;
    this.#landed = undefined;
    return true;
  }

  /** Whether the body is taller than the cap, so offsets are scaled. */
  get scaled(): boolean {
    return this.#logical > this.#cap;
  }

  /** The body's rendered height in px. */
  get size(): number {
    return Math.min(this.#logical, this.#cap);
  }

  /** How much longer the logical scroll range is than the physical one. */
  get excess(): number {
    return this.#logical - this.size;
  }

  /** The logical offset for a physical one, given the physical scroll range. */
  toLogical(physical: number, range: number): number {
    if (!this.scaled || range <= 0) return physical;
    const landed = this.#landed;
    if (landed?.physical === physical) return landed.logical;
    return (clamp(physical, range) * (range + this.excess)) / range;
  }

  /** The physical offset for a logical one, given the physical scroll range. */
  toPhysical(logical: number, range: number): number {
    if (!this.scaled || range <= 0) return logical;
    const total = range + this.excess;
    return (clamp(logical, total) * range) / total;
  }

  /**
   * Records that a write of the logical offset `logical` left the scroller at
   * `physical` (read back, after the engine's rounding), so reading that physical
   * offset gives the exact logical one again. Without it a scaled offset could be
   * off by up to the scale ratio, and a row scrolled to the top would sit under
   * the header by a few px.
   */
  land(logical: number, physical: number): void {
    this.#landed = this.scaled ? { physical, logical } : undefined;
  }
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
