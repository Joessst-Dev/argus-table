/** The row groups of the grid, top to bottom. */
export type GridSection = 'header' | 'top' | 'body' | 'bottom';

/** A row of the grid: its section and its index within it (the header is index 0). */
export interface GridRow {
  section: GridSection;
  index: number;
}

/**
 * Where each row sits in the grid as a whole: the header row, then the rows
 * pinned to the top, the body rows, and the rows pinned to the bottom. The
 * position is 0-based and `aria-rowindex` is one more. Keyboard navigation
 * steps through positions, so it crosses sections without special cases.
 */
export class RowLayout {
  readonly top: number;
  readonly body: number;
  readonly bottom: number;

  constructor(top: number, body: number, bottom: number) {
    this.top = top;
    this.body = body;
    this.bottom = bottom;
  }

  /** Number of rows, the header included (`aria-rowcount`). */
  get total(): number {
    return 1 + this.top + this.body + this.bottom;
  }

  /** 0-based position of a row in the grid. */
  position({ section, index }: GridRow): number {
    switch (section) {
      case 'header':
        return 0;
      case 'top':
        return 1 + index;
      case 'body':
        return 1 + this.top + index;
      case 'bottom':
        return 1 + this.top + this.body + index;
    }
  }

  /** The row at a 0-based position, or `undefined` outside the grid. */
  at(position: number): GridRow | undefined {
    if (!Number.isInteger(position) || position < 0 || position >= this.total) return undefined;
    if (position === 0) return { section: 'header', index: 0 };
    let index = position - 1;
    if (index < this.top) return { section: 'top', index };
    index -= this.top;
    if (index < this.body) return { section: 'body', index };
    return { section: 'bottom', index: index - this.body };
  }

  ariaRowIndex(row: GridRow): number {
    return this.position(row) + 1;
  }

  fromAriaRowIndex(ariaRowIndex: number): GridRow | undefined {
    return this.at(ariaRowIndex - 1);
  }
}
