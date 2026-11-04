import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { headerSlot, pinStyle } from './content.js';

/**
 * The sticky header row. Header content is slotted from the light DOM. Pinned
 * header cells use the same private `data-pin` hooks as body cells, but no parts.
 */
export function renderHeader<T>(columns: readonly ColumnView<T, CellContent>[]) {
  return html`<div part="header" role="rowgroup">
    <div part="header-row" class="row" role="row" aria-rowindex="1">
      ${repeat(
        columns,
        (c) => c.id,
        (c) =>
          html`<div
            part="header-cell"
            role="columnheader"
            aria-colindex=${c.colIndex}
            data-align=${c.align}
            data-pin=${c.pin ?? nothing}
            ?data-pin-edge=${c.pinEdge}
            style=${pinStyle(c) ?? nothing}
          >
            <slot name=${headerSlot(c.colIndex)}></slot>
          </div>`,
      )}
    </div>
  </div>`;
}
