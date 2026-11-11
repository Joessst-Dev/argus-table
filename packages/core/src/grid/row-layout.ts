/** The row groups of the grid, top to bottom. */
export type GridSection = 'header' | 'top' | 'body' | 'bottom';

/**
 * A row of the grid: its section and its index within it. Header rows count from
 * the top: with column groups the column headers are the last header row.
 */
export interface GridRow {
  section: GridSection;
  index: number;
}

/**
 * Where each row sits in the grid as a whole: the header rows, then the rows
 * pinned to the top, the body rows, and the rows pinned to the bottom. The
 * position is 0-based and `aria-rowindex` is one more. Keyboard navigation
 * steps through positions, so it crosses sections without special cases.
 */
export class RowLayout {
  readonly top: number;
  readonly body: number;
  readonly bottom: number;
  /** Number of header rows: one, and one more per level of column groups. */
  readonly header: number;

  constructor(top: number, body: number, bottom: number, header = 1) {
    this.top = top;
    this.body = body;
    this.bottom = bottom;
    this.header = Math.max(1, header);
  }

  /** Number of rows, the header rows included (`aria-rowcount`). */
  get total(): number {
    return this.header + this.top + this.body + this.bottom;
  }

  /** The row of column headers: the last header row. */
  get leafHeader(): GridRow {
    return { section: 'header', index: this.header - 1 };
  }

  /** 0-based position of a row in the grid. */
  position({ section, index }: GridRow): number {
    switch (section) {
      case 'header':
        return index;
      case 'top':
        return this.header + index;
      case 'body':
        return this.header + this.top + index;
      case 'bottom':
        return this.header + this.top + this.body + index;
    }
  }

  /** The row at a 0-based position, or `undefined` outside the grid. */
  at(position: number): GridRow | undefined {
    if (!Number.isInteger(position) || position < 0 || position >= this.total) return undefined;
    if (position < this.header) return { section: 'header', index: position };
    let index = position - this.header;
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
