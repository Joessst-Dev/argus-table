import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { ColumnView } from '@argus-table/core';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellParts, cellSlot, pinStyle } from './content.js';

type Columns<T> = readonly ColumnView<T, CellContent>[];

/** The cell holding the grid's tab stop: a row index and a column id. */
export interface ActiveCell {
  index: number;
  col: string;
}

/**
 * The virtualized body. Rows are keyed by pool slot, so a row entering the window
 * reuses the DOM of one that left (ADR 0001), and they stay in pool order: screen
 * readers get the position from `aria-rowindex` (the header row is 1).
 */
export function renderBody<T>(
  rows: readonly WindowRow[],
  columns: Columns<T>,
  totalSize: number,
  active: ActiveCell | undefined,
) {
  return html`<div
    part="body"
    role="rowgroup"
    style=${styleMap({ blockSize: `${String(totalSize)}px` })}
  >
    ${repeat(
      rows,
      (r) => r.slot,
      (r) => renderRow(r, columns, r.index === active?.index ? active.col : undefined),
    )}
  </div>`;
}

/**
 * One body row. Every cell is focusable (`tabindex=-1`) so clicks focus it; the
 * active one is the grid's single tab stop (roving tabindex).
 */
function renderRow<T>(row: WindowRow, columns: Columns<T>, activeCol: string | undefined) {
  return html`<div
    part=${row.index % 2 === 0 ? 'row row-even' : 'row row-odd'}
    class="row"
    role="row"
    aria-rowindex=${row.index + 2}
    style=${styleMap({ transform: `translateY(${String(row.start)}px)` })}
  >
    ${repeat(
      columns,
      (c) => c.id,
      (c) =>
        html`<div
          part=${cellParts(c)}
          role="gridcell"
          aria-colindex=${c.colIndex}
          tabindex=${c.id === activeCol ? 0 : -1}
          data-col=${c.id}
          data-align=${c.align}
          data-pin=${c.pin ?? nothing}
          style=${pinStyle(c) ?? nothing}
        >
          <slot name=${cellSlot(row.slot, c.colIndex)}></slot>
        </div>`,
    )}
  </div>`;
}
