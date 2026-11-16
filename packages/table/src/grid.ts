import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import {
  groupKey,
  RowLayout,
  type ColumnView,
  type GridRow,
  type OrderUnit,
  type TableModel,
} from '@argus-table/core';
import { INTERACTIVE } from './interactive.js';
import { columnKey } from './render/header.js';
import type { CellContent } from './types.js';

// Pure helpers of `<argus-table>`: where rows and cells are in the grid, and
// small pieces of its render. Nothing here keeps state.

/**
 * The sortable column a header click came from, if any. Works for slotted content
 * too. Clicks on a resize handle never sort, so a click that ends a drag doesn't,
 * and neither do clicks on interactive content in the header (a button, an input).
 */
export function sortColumnOf(event: Event): string | undefined {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue;
    if (target.dataset.resizeCol !== undefined) return undefined;
    if (target.matches(INTERACTIVE)) return undefined;
    if (target.dataset.sortCol !== undefined) return target.dataset.sortCol;
    if (target.getAttribute('role') === 'row') return undefined;
  }
  return undefined;
}

/**
 * The cell holding the grid's single tab stop: a row (its section, and its index
 * there: in the row model for the body, in its list for a pinned row) and a
 * column. `rowId` keeps it on the same body row when the order changes.
 */
export interface Active extends GridRow {
  rowId: string | undefined;
  col: string;
}

/** Where the rows sit in the grid: header rows, pinned top, body, pinned bottom. */
export function layoutOf<T>(model: TableModel<T, CellContent>): RowLayout {
  return new RowLayout(
    model.pinnedCount('top'),
    model.rowCount,
    model.pinnedCount('bottom'),
    model.headerRows,
  );
}

/** The drop slot and applied-move key of a column or group (`HeaderDrag.key`). */
export function unitKey(unit: OrderUnit): string {
  return unit.kind === 'column' ? columnKey(unit.id) : groupKey(unit.id, unit.pin);
}

/** The grid cell or column header an element is, if any. */
export function gridCell(target: EventTarget): HTMLElement | undefined {
  if (!(target instanceof HTMLElement) || target.dataset.col === undefined) return undefined;
  const role = target.getAttribute('role');
  return role === 'gridcell' || role === 'columnheader' ? target : undefined;
}

/** The column group header an element is, if any. */
export function groupCell(target: EventTarget): HTMLElement | undefined {
  return target instanceof HTMLElement && target.dataset.groupKey !== undefined
    ? target
    : undefined;
}

/** The grid row a rendered row element is, from its `aria-rowindex`. */
export function gridRowOf(row: Element | null, layout: RowLayout): GridRow | undefined {
  const index = row?.getAttribute('aria-rowindex');
  return index ? layout.fromAriaRowIndex(Number(index)) : undefined;
}

/** The grid row a cell or column header is in. */
export function gridRowOfCell(cell: HTMLElement, layout: RowLayout): GridRow | undefined {
  return gridRowOf(cell.parentElement, layout);
}

/**
 * The pinned edge's shadow, drawn once per side over the scroller rather than
 * per row: a shadow on every pinned cell repaints on every scroll frame. It
 * covers the pinned columns and casts `--argus-pinned-shadow` onto the rest;
 * PinScrollController sizes it to the visible area.
 */
export function pinShadow(
  side: 'start' | 'end',
  width: number,
  contentPx: number,
): TemplateResult | typeof nothing {
  if (width === 0) return nothing;
  return html`<div
    class="pin-shadow"
    data-side=${side}
    aria-hidden="true"
    style=${styleMap({
      inlineSize: `${String(width)}px`,
      '--_content-h': `${String(contentPx)}px`,
    })}
  ></div>`;
}

/** CSS grid track for a column: fixed px, or a flex share with the min width as floor. */
export function track<T>(column: ColumnView<T, CellContent>): string {
  return column.flex === undefined
    ? `${String(column.width)}px`
    : `minmax(${String(column.minWidth)}px, ${String(column.flex)}fr)`;
}

/** Total width of the columns pinned to one side. */
export function pinnedWidth<T>(
  columns: readonly ColumnView<T, CellContent>[],
  side: 'start' | 'end',
): number {
  return columns.reduce((sum, c) => (c.pin === side ? sum + c.width : sum), 0);
}
