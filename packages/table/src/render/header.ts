import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { ariaSort, headerSlot, pinStyle } from './content.js';

export interface HeaderHandlers {
  click: (event: MouseEvent) => void;
  pointerdown: (event: PointerEvent) => void;
}

/**
 * The sticky header row. Header content is slotted from the light DOM. Pinned
 * header cells use the same private `data-pin` hooks as body cells, but no parts.
 * Every header carries `data-col` (its column id) and sortable ones also
 * `data-sort-col`; the element's delegated handlers read them. Headers take part
 * in the grid's roving tabindex: the active one is the tab stop (`activeCol`).
 * Resizable columns get a `resize-handle` on the header's inline-end edge. It is
 * not focusable: the focused header resizes with Alt+Arrow.
 */
export function renderHeader<T>(
  columns: readonly ColumnView<T, CellContent>[],
  handlers: HeaderHandlers,
  activeCol: string | undefined,
) {
  return html`<div part="header" role="rowgroup">
    <div
      part="header-row"
      class="row"
      role="row"
      aria-rowindex="1"
      @click=${handlers.click}
      @pointerdown=${handlers.pointerdown}
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
            data-col=${c.id}
            data-sort-col=${c.sortable ? c.id : nothing}
            tabindex=${c.id === activeCol ? 0 : -1}
            data-align=${c.align}
            data-pin=${c.pin ?? nothing}
            ?data-pin-edge=${c.pinEdge}
            style=${pinStyle(c) ?? nothing}
          >
            <slot name=${headerSlot(c.colIndex)}></slot>
            ${c.sortable ? html`<span class="sort-indicator" aria-hidden="true"></span>` : nothing}
            ${c.resizable ? resizeHandle(c) : nothing}
          </div>`,
      )}
    </div>
  </div>`;
}

/**
 * A vertical separator with the column's width as its value. A flex column has no
 * fixed width until it is resized, so it reports none.
 */
function resizeHandle<T>(c: ColumnView<T, CellContent>) {
  return html`<div
    part="resize-handle"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize column"
    aria-valuenow=${c.flex === undefined ? Math.round(c.width) : nothing}
    aria-valuemin=${c.minWidth}
    aria-valuemax=${Number.isFinite(c.maxWidth) ? c.maxWidth : nothing}
    data-resize-col=${c.id}
  ></div>`;
}
