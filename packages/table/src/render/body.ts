import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { ColumnView } from '@argus-table/core';
import type { WindowRow } from '../controllers/virtual-controller.js';
import type { CellContent } from '../types.js';
import { cellParts, cellSlot, pinStyle } from './content.js';

type Columns<T> = readonly ColumnView<T, CellContent>[];

/**
 * The virtualized body. Rows are keyed by pool slot, so a row entering the window
 * reuses the DOM of one that left (ADR 0001), and they stay in pool order: screen
 * readers get the position from `aria-rowindex` (the header row is 1).
 */
export function renderBody<T>(rows: readonly WindowRow[], columns: Columns<T>, totalSize: number) {
  return html`<div
    part="body"
    role="rowgroup"
    style=${styleMap({ blockSize: `${String(totalSize)}px` })}
  >
    ${repeat(
      rows,
      (r) => r.slot,
      (r) => renderRow(r, columns),
    )}
  </div>`;
}

function renderRow<T>(row: WindowRow, columns: Columns<T>) {
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
          data-align=${c.align}
          data-pin=${c.pin ?? nothing}
          ?data-pin-edge=${c.pinEdge}
          style=${pinStyle(c) ?? nothing}
        >
          <slot name=${cellSlot(row.slot, c.colIndex)}></slot>
        </div>`,
    )}
  </div>`;
}
