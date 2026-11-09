/** A rendered row and the pool slot whose DOM it uses. */
export interface PoolEntry {
  id: string;
  slot: number;
}

/**
 * Assigns pool slots to rendered rows (ADR 0001), and with `virtualizeColumns`
 * to rendered columns too (the ids are then column ids).
 *
 * A row keeps its slot while it stays rendered. A row entering the window takes a
 * slot freed by a row that left, so its DOM is updated in place rather than created.
 * Rows are returned in slot order ("pool order"); the ADR 0001 addendum ruled out
 * re-sorting them by row index, so assistive tech gets row positions from
 * `aria-rowindex` instead.
 */
export class RowPool {
  #slots = new Map<string, number>();
  #free: number[] = [];
  #size = 0;
  #pinned: string | undefined;

  /** Number of slots created so far: the most rows rendered at once. */
  get size(): number {
    return this.#size;
  }

  /** The row id whose slot is kept while it is out of range, if any. */
  get pinned(): string | undefined {
    return this.#pinned;
  }

  /**
   * Keeps one row's slot, and keeps it rendered, while it is outside the rendered
   * range. Used for the row holding focus. `undefined` releases it.
   */
  pin(id: string | undefined): void {
    this.#pinned = id;
  }

  /** The slot a row holds, or `undefined` when it isn't rendered. */
  slotOf(id: string): number | undefined {
    return this.#slots.get(id);
  }

  /**
   * Updates the pool for the rows that should be rendered and returns them, plus the
   * pinned row if it isn't among them, in slot order.
   */
  update(ids: Iterable<string>): PoolEntry[] {
    const keep = new Set(ids);
    if (this.#pinned !== undefined) keep.add(this.#pinned);

    for (const [id, slot] of this.#slots) {
      if (!keep.has(id)) {
        this.#slots.delete(id);
        this.#free.push(slot);
      }
    }
    for (const id of keep) {
      if (!this.#slots.has(id)) this.#slots.set(id, this.#free.pop() ?? this.#size++);
    }

    const entries: PoolEntry[] = [];
    for (const [id, slot] of this.#slots) entries.push({ id, slot });
    return entries.sort((a, b) => a.slot - b.slot);
  }

  /** Frees every slot, for example when the data is replaced. */
  clear(): void {
    this.#slots.clear();
    this.#free = [];
    this.#size = 0;
    this.#pinned = undefined;
  }
}
