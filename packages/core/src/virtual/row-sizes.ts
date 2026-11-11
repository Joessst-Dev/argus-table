/**
 * Row heights for rows that aren't all the same height (`rowHeight: 'auto'`):
 * every row is `estimate` px until it is measured. Offsets, the row at an
 * offset and the total take O(log n), so measuring a row near the top of a
 * million rows doesn't recompute every row below it.
 *
 * A Fenwick tree over each row's difference from the estimate. Nothing is
 * allocated until a row differs from the estimate: one-line rows cost nothing.
 */
export class RowSizes {
  #count = 0;
  #estimate = 1;
  /** Each row's difference from the estimate; `undefined` while every row is the estimate. */
  #delta: Float64Array | undefined;
  /** Fenwick tree over `#delta`, 1-based. */
  #tree: Float64Array | undefined;
  /** The highest power of two at most `#count`, for `indexAt`. */
  #step = 0;
  /** The sum of all differences. */
  #sum = 0;

  /** Number of rows. */
  get count(): number {
    return this.#count;
  }

  /** The height of all rows. */
  get total(): number {
    return this.#count * this.#estimate + this.#sum;
  }

  /**
   * Starts over: `count` rows of `estimate` px, then the heights in `sizes`
   * (`[index, px]`; indexes out of range are ignored). O(count).
   */
  reset(count: number, estimate: number, sizes: Iterable<readonly [number, number]> = []): void {
    this.#count = Math.max(0, Math.floor(count));
    this.#estimate = estimate > 0 ? estimate : 1;
    this.#step = highestPowerOfTwo(this.#count);
    this.#sum = 0;
    let delta: Float64Array | undefined;
    for (const [index, px] of sizes) {
      if (index < 0 || index >= this.#count || !Number.isFinite(px)) continue;
      const d = px - this.#estimate;
      if (d === 0) continue;
      delta ??= this.#buffer(this.#count);
      this.#sum += d - (delta[index] ?? 0);
      delta[index] = d;
    }
    if (delta) this.#build(delta);
    else this.#clear();
  }

  /**
   * Changes the number of rows (a data source counting more), keeping the
   * heights of the rows that stay. O(count) when any row was measured.
   */
  resize(count: number): void {
    count = Math.max(0, Math.floor(count));
    if (count === this.#count) return;
    const old = this.#delta;
    this.#count = count;
    this.#step = highestPowerOfTwo(count);
    if (!old) return;
    const delta = new Float64Array(count);
    delta.set(old.subarray(0, Math.min(count, old.length)));
    this.#sum = 0;
    for (const d of delta) this.#sum += d;
    this.#build(delta);
  }

  /** The height of the row at `index`. */
  sizeOf(index: number): number {
    return this.#estimate + (this.#delta?.[index] ?? 0);
  }

  /** Sets the height of the row at `index`. Returns how much it changed by. */
  set(index: number, px: number): number {
    if (index < 0 || index >= this.#count || !Number.isFinite(px)) return 0;
    const d = px - this.sizeOf(index);
    if (Math.abs(d) < 1e-6) return 0;
    if (!this.#delta || !this.#tree) this.#build(this.#buffer(this.#count));
    const delta = this.#delta;
    const tree = this.#tree;
    if (!delta || !tree) return 0;
    delta[index] = (delta[index] ?? 0) + d;
    for (let i = index + 1; i <= this.#count; i += i & -i) tree[i] = (tree[i] ?? 0) + d;
    this.#sum += d;
    return d;
  }

  /** The offset of the row at `index` from the first row's top: the heights of the rows before it. */
  startOf(index: number): number {
    const i = Math.min(Math.max(Math.floor(index), 0), this.#count);
    let start = i * this.#estimate;
    const tree = this.#tree;
    if (tree) for (let j = i; j > 0; j -= j & -j) start += tree[j] ?? 0;
    return start;
  }

  /** The row at `offset` px from the first row's top, clamped to the rows. 0 when there are none. */
  indexAt(offset: number): number {
    const count = this.#count;
    if (count === 0 || !(offset > 0)) return 0;
    const estimate = this.#estimate;
    const tree = this.#tree;
    let index: number;
    if (!tree) {
      index = Math.floor(offset / estimate);
    } else {
      // The most rows whose heights add up to at most `offset`: that many rows
      // end at or above it, so the row at it is the next one.
      index = 0;
      let rest = offset;
      for (let step = this.#step; step > 0; step >>= 1) {
        const next = index + step;
        if (next > count) continue;
        const size = step * estimate + (tree[next] ?? 0);
        if (size <= rest) {
          index = next;
          rest -= size;
        }
      }
    }
    return Math.min(index, count - 1);
  }

  /** A zeroed buffer for `count` differences, reusing the current one when it fits. */
  #buffer(count: number): Float64Array {
    const delta = this.#delta;
    if (delta?.length === count) {
      delta.fill(0);
      return delta;
    }
    return new Float64Array(count);
  }

  /** Builds the tree over `delta` in O(count). */
  #build(delta: Float64Array): void {
    const count = this.#count;
    let tree = this.#tree;
    if (tree?.length !== count + 1) tree = new Float64Array(count + 1);
    tree.set(delta, 1);
    tree[0] = 0;
    for (let i = 1; i <= count; i++) {
      const parent = i + (i & -i);
      if (parent <= count) tree[parent] = (tree[parent] ?? 0) + (tree[i] ?? 0);
    }
    this.#delta = delta;
    this.#tree = tree;
  }

  #clear(): void {
    this.#delta = undefined;
    this.#tree = undefined;
  }
}

function highestPowerOfTwo(n: number): number {
  let step = 1;
  while (step * 2 <= n) step *= 2;
  return n > 0 ? step : 0;
}
