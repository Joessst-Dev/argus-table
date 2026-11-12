import { html, nothing } from 'lit';
import type { HeaderGroupCell } from '@argus-table/core';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import type { RenderedColumn } from '../controllers/column-window.js';
import type { DropTarget } from '../controllers/reorder-drag.js';
import type { CellContent } from '../types.js';
import {
  ariaSort,
  cellStyle,
  groupSlot,
  groupStyle,
  headerSlot,
  type CheckboxHandlers,
} from './content.js';

/**
 * A column or group header being dragged, and where it would land (`undefined`:
 * where it is). `key` is the drop slot key of what moves (see `unitKey`).
 */
export interface HeaderDrag {
  key: string;
  /** The columns that move: the column, or the group's columns on its side. */
  columns: ReadonlySet<string>;
  target: DropTarget | undefined;
}

/** The drop slot key of a column (`c:` and its id) or a group cell (its `key`). */
export const columnKey = (columnId: string) => `c:${columnId}`;

export interface HeaderOptions<T> {
  columns: readonly RenderedColumn<T>[];
  /** The group header rows above the column headers, top first. */
  groups: readonly (readonly HeaderGroupCell<CellContent>[])[];
  handlers: HeaderHandlers;
  /** The active cell when it is in the header: its header row and column. */
  active: { index: number; col: string } | undefined;
  drag?: HeaderDrag | undefined;
  checkAll?: CheckAll | undefined;
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
 * The sticky header: a row per level of column groups, then the row of column
 * headers. Header content is slotted from the light DOM. Pinned
 * header cells use the same private `data-pin` hooks as body cells, and the parts
 * `header-cell-pinned` and `header-cell-pinned-edge`.
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
export function renderHeader<T>({
  columns,
  groups,
  handlers,
  active,
  drag,
  checkAll,
}: HeaderOptions<T>) {
  const leaf = groups.length;
  const activeCol = active?.index === leaf ? active.col : undefined;
  return html`<div
    part="header"
    role="rowgroup"
    @click=${handlers.click}
    @pointerdown=${handlers.pointerdown}
    @dblclick=${handlers.dblclick}
  >
    ${groups.map((cells, level) => groupRow(cells, level, active, drag))}
    <div part="header-row" class="row" role="row" aria-rowindex=${leaf + 1}>
      ${repeat(
        columns,
        (c) => c.key,
        (c) =>
          html`<div
            part=${headerParts(c, drag)}
            role="columnheader"
            aria-colindex=${c.colIndex}
            aria-sort=${ariaSort(c.sorted) ?? nothing}
            aria-description=${c.filtered ? 'Filtered' : nothing}
            data-col=${c.id}
            data-sort-col=${c.sortable ? c.id : nothing}
            data-move-col=${c.reorderable ? c.id : nothing}
            tabindex=${c.id === activeCol ? 0 : -1}
            data-align=${c.align}
            data-pin=${c.pin ?? nothing}
            style=${cellStyle(c) ?? nothing}
          >
            ${
              c.kind === 'selection'
                ? selectAllCheckbox(checkAll)
                : html`<slot name=${headerSlot(c.slot)}></slot>`
            }
            ${
              c.sortable
                ? html`<span
                    part="sort-indicator"
                    class="sort-indicator"
                    aria-hidden="true"
                  ></span>`
                : nothing
            }
            ${c.filtered ? html`<span part="filter-indicator" aria-hidden="true"></span>` : nothing}
            ${c.resizable ? resizeHandle(c) : nothing}
            ${
              drag?.target?.id === columnKey(c.id)
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

function headerParts<T>(c: RenderedColumn<T>, drag: HeaderDrag | undefined): string {
  let parts = c.sorted
    ? `header-cell header-cell-sorted header-cell-sorted-${c.sorted}`
    : 'header-cell';
  if (c.pin)
    parts += c.pinEdge ? ' header-cell-pinned header-cell-pinned-edge' : ' header-cell-pinned';
  if (c.filtered) parts += ' header-cell-filtered';
  if (c.kind === 'selection') parts += ' header-cell-selection';
  if (drag?.columns.has(c.id)) parts += ' header-cell-dragging';
  return parts;
}

/**
 * A row of group headers. Every group cell renders, also with `virtualizeColumns`
 * (there are few, and their slots stay put). A group's cell is a `columnheader`
 * spanning its columns (`aria-colspan`), focusable through the roving tabindex,
 * with `data-group-key`; columns without a group at this level sit under an empty
 * filler `gridcell`, so every row covers every column. Neither carries `data-col`:
 * they are no column's header. A group with a resizable column has a
 * `resize-handle` too (`data-resize-group`).
 */
function groupRow(
  cells: readonly HeaderGroupCell<CellContent>[],
  level: number,
  active: { index: number; col: string } | undefined,
  drag: HeaderDrag | undefined,
) {
  const activeCol = active?.index === level ? active.col : undefined;
  return html`<div part="header-group-row" class="row" role="row" aria-rowindex=${level + 1}>
    ${repeat(
      cells,
      (c) => c.key,
      (c) =>
        c.kind === 'filler'
          ? html`<div
              part="header-group-filler"
              role="gridcell"
              aria-colindex=${c.colIndex}
              aria-colspan=${c.span}
              data-pin=${c.pin ?? nothing}
              style=${groupStyle(c)}
            ></div>`
          : html`<div
              part=${
                drag?.key === c.key
                  ? 'header-group-cell header-group-cell-dragging'
                  : 'header-group-cell'
              }
              role="columnheader"
              aria-colindex=${c.colIndex}
              aria-colspan=${c.span}
              data-group-key=${c.key}
              data-move-group=${c.movable ? c.key : nothing}
              tabindex=${activeCol !== undefined && c.columns.includes(activeCol) ? 0 : -1}
              data-pin=${c.pin ?? nothing}
              style=${groupStyle(c)}
            >
              <span class="group-label"><slot name=${groupSlot(c.slot)}></slot></span>
              ${c.resizable ? groupResizeHandle(c.key) : nothing}
              ${
                drag?.target?.id === c.key
                  ? html`<span
                      part="drop-indicator"
                      data-edge=${drag.target.edge}
                      aria-hidden="true"
                    ></span>`
                  : nothing
              }
            </div>`,
    )}
  </div>`;
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
 * A group's resize handle: dragging it resizes the group's resizable columns,
 * each in proportion to its width; a double-click fits them to their content.
 */
function groupResizeHandle(key: string) {
  return html`<div
    part="resize-handle"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize group"
    data-resize-group=${key}
  ></div>`;
}

/**
 * A vertical separator with the column's width as its value. A flex column has no
 * fixed width until it is resized, so it reports none.
 */
function resizeHandle<T>(c: RenderedColumn<T>) {
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
