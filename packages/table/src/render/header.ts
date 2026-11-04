import { html, nothing } from 'lit';
import type { ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { headerSlot, pinStyle } from './content.js';
import { renderCells } from './pinned.js';

/**
 * The sticky header row. Header content is slotted from the light DOM. Pinned
 * header cells use the same private `data-pin` hooks as body cells, but no parts.
 */
export function renderHeader<T>(columns: readonly ColumnView<T, CellContent>[], grouped: boolean) {
  return html`<div part="header" role="rowgroup">
    <div part="header-row" class="row" role="row" aria-rowindex="1">
      ${renderCells(
        columns,
        (c) =>
          html`<div
            part="header-cell"
            role="columnheader"
            aria-colindex=${c.colIndex}
            data-align=${c.align}
            data-pin=${c.pin ?? nothing}
            ?data-pin-edge=${c.pinEdge}
            style=${(grouped ? undefined : pinStyle(c)) ?? nothing}
          >
            <slot name=${headerSlot(c.colIndex)}></slot>
          </div>`,
        grouped,
      )}
    </div>
  </div>`;
}
