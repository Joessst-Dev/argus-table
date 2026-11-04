import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { ariaSort, headerSlot, pinStyle } from './content.js';

export interface HeaderHandlers {
  click: (event: MouseEvent) => void;
  keydown: (event: KeyboardEvent) => void;
}

/**
 * The sticky header row. Header content is slotted from the light DOM. Pinned
 * header cells use the same private `data-pin` hooks as body cells, but no parts.
 * Sortable headers carry `data-sort-col` with their column id; the element's
 * delegated handlers on the header row read it.
 */
export function renderHeader<T>(
  columns: readonly ColumnView<T, CellContent>[],
  handlers: HeaderHandlers,
) {
  return html`<div part="header" role="rowgroup">
    <div
      part="header-row"
      class="row"
      role="row"
      aria-rowindex="1"
      @click=${handlers.click}
      @keydown=${handlers.keydown}
    >
      ${repeat(
        columns,
        (c) => c.id,
        (c) =>
          html`<div
            part=${c.sorted ? 'header-cell header-cell-sorted' : 'header-cell'}
            role="columnheader"
            aria-colindex=${c.colIndex}
            aria-sort=${ariaSort(c.sorted) ?? nothing}
            data-sort-col=${c.sortable ? c.id : nothing}
            tabindex=${c.sortable ? 0 : nothing}
            data-align=${c.align}
            data-pin=${c.pin ?? nothing}
            ?data-pin-edge=${c.pinEdge}
            style=${pinStyle(c) ?? nothing}
          >
            <slot name=${headerSlot(c.colIndex)}></slot>
            ${c.sortable ? html`<span class="sort-indicator" aria-hidden="true"></span>` : nothing}
          </div>`,
      )}
    </div>
  </div>`;
}
