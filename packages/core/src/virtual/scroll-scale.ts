/**
 * Maps the scroll position of a body that is too tall to render onto the rows.
 *
 * Engines limit an element's height (about 33.5M px in Chromium and WebKit, less
 * when zoomed; about 17.9M px in Firefox, which drops a taller element to 0, and
 * lets go of sticky elements past 8.95M px of scrolling, so 8M px there). A
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
  /** A point the mapping passes through instead of the straight line (see `pivot`). */
  #pivot: { physical: number; logical: number; range: number } | undefined;

  /**
   * `logical`: the height of all body rows in px. `cap`: the tallest body the
   * engine renders. Returns whether anything changed.
   */
  configure(logical: number, cap: number): boolean {
    if (logical === this.#logical && cap === this.#cap) return false;
    this.#logical = logical;
    this.#cap = cap;
    this.#landed = undefined;
    this.#pivot = undefined;
    return true;
  }

  /**
   * Bends the mapping so that the physical offset `physical` maps to `logical`:
   * linear from the top to that point and from there to the bottom. Measured row
   * heights change the logical height of a scaled body while it scrolls; pivoting
   * at the current offset keeps the rows in view where they are, without writing
   * the scroll position (which would cut a scroll short). Call after
   * `configure()`, which drops the pivot. Ignored at the ends of the range,
   * where the straight line keeps the first and the last row reachable.
   */
  pivot(physical: number, logical: number, range: number): void {
    this.#landed = undefined;
    const total = range + this.excess;
    const inside =
      this.scaled && physical > 1 && physical < range - 1 && logical > 0 && logical < total;
    this.#pivot = inside ? { physical, logical, range } : undefined;
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
    const total = range + this.excess;
    const p = clamp(physical, range);
    const pivot = this.#pivotFor(range);
    if (!pivot) return (p * total) / range;
    if (p <= pivot.physical) return (p * pivot.logical) / pivot.physical;
    return (
      pivot.logical + ((p - pivot.physical) * (total - pivot.logical)) / (range - pivot.physical)
    );
  }

  /** The physical offset for a logical one, given the physical scroll range. */
  toPhysical(logical: number, range: number): number {
    if (!this.scaled || range <= 0) return logical;
    const total = range + this.excess;
    const l = clamp(logical, total);
    const pivot = this.#pivotFor(range);
    if (!pivot) return (l * range) / total;
    if (l <= pivot.logical) return (l * pivot.physical) / pivot.logical;
    return (
      pivot.physical + ((l - pivot.logical) * (range - pivot.physical)) / (total - pivot.logical)
    );
  }

  /** The pivot, if it was set for this range and is still inside it. */
  #pivotFor(range: number) {
    const pivot = this.#pivot;
    if (pivot?.range !== range || pivot.logical >= range + this.excess) return undefined;
    return pivot;
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
