import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView, RowPin } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { renderCell, type ActiveCell } from './body.js';
import { pinnedSlot } from './content.js';

/**
 * The rows pinned to one side: a sticky row group below the header (`top`) or
 * at the bottom of the view (`bottom`). They are few and never recycled, so
 * they aren't pooled; content is slotted from the light DOM like body cells.
 * Cells take part in the grid's roving tabindex (`active.index` is the row's
 * index in its list). `firstRowIndex` is the `aria-rowindex` of the first row.
 */
export function renderPinnedRows<T>(
  side: RowPin,
  count: number,
  columns: readonly ColumnView<T, CellContent>[],
  firstRowIndex: number,
  active: ActiveCell | undefined,
) {
  if (count === 0) return nothing;
  const rows = Array.from({ length: count }, (_, i) => i);
  return html`<div class="pinned" data-side=${side} role="rowgroup">
    ${rows.map(
      (i) =>
        html`<div
          part=${`row row-pinned row-pinned-${side}`}
          class="row"
          role="row"
          aria-rowindex=${firstRowIndex + i}
        >
          ${repeat(
            columns,
            (c) => c.id,
            (c) =>
              renderCell(
                c,
                active?.index === i && c.id === active.col,
                pinnedSlot(side, i, c.colIndex),
                true,
              ),
          )}
        </div>`,
    )}
  </div>`;
}
