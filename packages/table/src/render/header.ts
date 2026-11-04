import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { headerSlot } from './content.js';

/** The sticky header row. Header content is slotted from the light DOM. */
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
          >
            <slot name=${headerSlot(c.colIndex)}></slot>
          </div>`,
      )}
    </div>
  </div>`;
}
