import { html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import type { ColumnView } from '@argus-table/core';
import type { DropTarget } from '../controllers/reorder-drag.js';
import type { CellContent } from '../types.js';
import { ariaSort, headerSlot, pinStyle, type CheckboxHandlers } from './content.js';

/** A column header being dragged, and where it would land (`undefined`: where it is). */
export interface HeaderDrag {
  columnId: string;
  target: DropTarget | undefined;
}

export interface HeaderHandlers {
  click: (event: MouseEvent) => void;
  pointerdown: (event: PointerEvent) => void;
  dblclick: (event: MouseEvent) => void;
}

/**
 * The select-all checkbox in the selection column's header, with
 * `selectionMode` `'multi'`: checked when every selectable row is, mixed when
 * some are.
 */
export interface CheckAll {
  state: 'all' | 'some' | 'none';
  handlers: CheckboxHandlers;
}

/**
 * The sticky header row. Header content is slotted from the light DOM. Pinned
 * header cells use the same private `data-pin` hooks as body cells, but no parts.
 * Every header carries `data-col` (its column id) and sortable ones also
 * `data-sort-col`; the element's delegated handlers read them. Headers take part
 * in the grid's roving tabindex: the active one is the tab stop (`activeCol`).
 * Resizable columns get a `resize-handle` on the header's inline-end edge; a
 * double-click on it fits the column to its content. It is not focusable: the
 * focused header resizes with Alt+Arrow.
 *
 * Reorderable columns carry `data-move-col`: a drag on the header moves the
 * column. While one is dragged (`drag`), its header adds `header-cell-dragging`
 * and the target header shows a `drop-indicator` on the edge it would land at.
 */
export function renderHeader<T>(
  columns: readonly ColumnView<T, CellContent>[],
  handlers: HeaderHandlers,
  activeCol: string | undefined,
  drag?: HeaderDrag,
  checkAll?: CheckAll,
) {
  return html`<div part="header" role="rowgroup">
    <div
      part="header-row"
      class="row"
      role="row"
      aria-rowindex="1"
      @click=${handlers.click}
      @pointerdown=${handlers.pointerdown}
      @dblclick=${handlers.dblclick}
    >
      ${repeat(
        columns,
        (c) => c.id,
        (c) =>
          html`<div
            part=${headerParts(c, drag)}
            role="columnheader"
            aria-colindex=${c.colIndex}
            aria-sort=${ariaSort(c.sorted) ?? nothing}
            data-col=${c.id}
            data-sort-col=${c.sortable ? c.id : nothing}
            data-move-col=${c.reorderable ? c.id : nothing}
            tabindex=${c.id === activeCol ? 0 : -1}
            data-align=${c.align}
            data-pin=${c.pin ?? nothing}
            style=${pinStyle(c) ?? nothing}
          >
            ${
              c.kind === 'selection'
                ? selectAllCheckbox(checkAll)
                : html`<slot name=${headerSlot(c.colIndex)}></slot>`
            }
            ${c.sortable ? html`<span class="sort-indicator" aria-hidden="true"></span>` : nothing}
            ${c.resizable ? resizeHandle(c) : nothing}
            ${
              drag?.target?.columnId === c.id
                ? html`<span
                    part="drop-indicator"
                    data-edge=${drag.target.edge}
                    aria-hidden="true"
                  ></span>`
                : nothing
            }
          </div>`,
      )}
    </div>
  </div>`;
}

function headerParts<T>(c: ColumnView<T, CellContent>, drag: HeaderDrag | undefined): string {
  let parts = c.sorted ? 'header-cell header-cell-sorted' : 'header-cell';
  if (c.kind === 'selection') parts += ' header-cell-selection';
  if (drag?.columnId === c.id) parts += ' header-cell-dragging';
  return parts;
}

/** The header's select-all checkbox: not focusable, like the rows' (the header cell holds focus). */
function selectAllCheckbox(checkAll: CheckAll | undefined) {
  if (!checkAll) return nothing;
  return html`<input
    type="checkbox"
    part="selection-checkbox"
    tabindex="-1"
    aria-label="Select all rows"
    .checked=${live(checkAll.state === 'all')}
    .indeterminate=${live(checkAll.state === 'some')}
    @click=${checkAll.handlers.all}
    @mousedown=${checkAll.handlers.press}
  />`;
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
